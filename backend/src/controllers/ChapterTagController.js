import ChapterTag from "../models/ChapterTag.js";
import ChapterTagFolder from "../models/ChapterTagFolder.js";
import Question from "../models/Question.js";
import { ensurePositions } from "./ChapterTagFolderController.js";

function isValidObjectId(id) {
  return typeof id === "string" && id.match(/^[a-fA-F0-9]{24}$/);
}

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeKey(name) {
  return normalizeName(name).toLowerCase();
}

// GET /chapter-tags?includeInactive=1&folderId=
export async function listChapterTags(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "1";
    const folderId = isValidObjectId(req.query.folderId) ? req.query.folderId : null;

    const filter = {
      owner: req.userId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(folderId !== null ? { folder: folderId } : {}),
    };

    const tags = await ChapterTag.find(filter)
      .sort({ name: 1 })
      .lean();

    return res.json(tags);
  } catch (err) {
    console.error("Erro em listChapterTags:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// GET /chapter-tags/grouped?includeInactive=1
export async function listGroupedChapterTags(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "1";

    const folderFilter = {
      owner: req.userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const tagFilter = {
      owner: req.userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const [folders, tags] = await Promise.all([
      ensurePositions(req.userId),
      ChapterTag.find(tagFilter).sort({ name: 1 }).lean(),
    ]);

    const filteredFolders = folders.filter((f) => includeInactive || f.isActive);

    const grouped = [];
    const tagsByFolder = new Map();

    filteredFolders.forEach((folder) => {
      tagsByFolder.set(String(folder._id), []);
    });

    const unassigned = [];

    tags.forEach((tag) => {
      const key = tag.folder ? String(tag.folder) : null;
      if (key && tagsByFolder.has(key)) {
        tagsByFolder.get(key).push(tag);
      } else {
        unassigned.push(tag);
      }
    });

    filteredFolders.forEach((folder) => {
      grouped.push({ folder, tags: tagsByFolder.get(String(folder._id)) || [] });
    });

    grouped.push({ folder: null, tags: unassigned });

    return res.json(grouped);
  } catch (err) {
    console.error("Erro em listGroupedChapterTags:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// POST /chapter-tags { name, folderId? }
// Idempotente: se já existir (normalizedName) na pasta, devolve conflito
export async function createChapterTag(req, res) {
  try {
    const { name, folderId } = req.body || {};
    const cleanName = normalizeName(name);

    if (!cleanName) {
      return res.status(400).json({ error: "name é obrigatório" });
    }

    let folder = null;
    if (folderId) {
      if (!isValidObjectId(folderId)) {
        return res.status(400).json({ error: "folderId inválido" });
      }
      folder = await ChapterTagFolder.findOne({ _id: folderId, owner: req.userId });
      if (!folder) {
        return res.status(404).json({ error: "Pasta não encontrada" });
      }
    }

    const normalizedName = normalizeKey(cleanName);

    const existing = await ChapterTag.findOne({ owner: req.userId, normalizedName, folder: folder ? folder._id : null });
    if (existing) {
      if (existing.isActive === false) {
        existing.isActive = true;
        await existing.save();
        return res.status(200).json(existing);
      }
      return res.status(409).json({ error: "Já existe uma tag com esse nome nesta pasta" });
    }

    const tag = await ChapterTag.create({
      name: cleanName,
      normalizedName,
      isActive: true,
      owner: req.userId,
      folder: folder ? folder._id : null,
    });

    return res.status(201).json(tag);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma tag com esse nome nesta pasta" });
    }
    console.error("Erro em createChapterTag:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PUT /chapter-tags/:id { name?, isActive?, folderId? }
export async function updateChapterTag(req, res) {
  try {
    const { id } = req.params;
    const { name, isActive, folderId } = req.body || {};

    const tag = await ChapterTag.findOne({ _id: id, owner: req.userId });
    if (!tag) {
      return res.status(404).json({ error: "Tag não encontrada" });
    }

    if (name !== undefined) {
      const cleanName = normalizeName(name);
      if (!cleanName) {
        return res.status(400).json({ error: "name inválido" });
      }
      tag.name = cleanName;
      tag.normalizedName = normalizeKey(cleanName);
    }

    if (folderId !== undefined) {
      if (!folderId) {
        tag.folder = null;
      } else {
        if (!isValidObjectId(folderId)) {
          return res.status(400).json({ error: "folderId inválido" });
        }
        const folder = await ChapterTagFolder.findOne({ _id: folderId, owner: req.userId });
        if (!folder) {
          return res.status(404).json({ error: "Pasta não encontrada" });
        }
        tag.folder = folder._id;
      }
    }

    if (isActive !== undefined) {
      tag.isActive = Boolean(isActive);
    }

    await tag.save();
    res.json(tag);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma tag com esse nome nesta pasta" });
    }
    console.error("Erro em updateChapterTag:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// DELETE /chapter-tags/:id (soft delete)
export async function deleteChapterTag(req, res) {
  try {
    const { id } = req.params;
    const forceDelete = ["1", "true", "yes"].includes(
      String(req.query.force || req.query.permanent || "").toLowerCase()
    );

    const tag = await ChapterTag.findOne({ _id: id, owner: req.userId });
    if (!tag) {
      return res.status(404).json({ error: "Tag não encontrada" });
    }

    if (forceDelete) {
      await Promise.all([
        Question.updateMany(
          { chapterTags: tag._id },
          { $pull: { chapterTags: tag._id } }
        ),
        ChapterTag.deleteOne({ _id: tag._id })
      ]);

      return res.json({ message: "Tag eliminada com sucesso" });
    }

    tag.isActive = false;
    await tag.save();

    res.json({ message: "Tag desativada com sucesso" });
  } catch (err) {
    console.error("Erro em deleteChapterTag:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
