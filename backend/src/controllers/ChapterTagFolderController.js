import ChapterTagFolder from "../models/ChapterTagFolder.js";
import ChapterTag from "../models/ChapterTag.js";

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeKey(name) {
  return normalizeName(name).toLowerCase();
}

async function nextPosition(ownerId) {
  const last = await ChapterTagFolder.findOne({ owner: ownerId })
    .sort({ position: -1 })
    .select("position")
    .lean();
  return last ? Number(last.position || 0) + 1 : 0;
}

export async function ensurePositions(ownerId) {
  const folders = await ChapterTagFolder.find({ owner: ownerId })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  const needsFix = folders.some((f, idx) => f.position === undefined || f.position === null || f.position !== idx);
  if (!needsFix) return folders;

  const bulk = folders.map((f, idx) => ({
    updateOne: { filter: { _id: f._id }, update: { $set: { position: idx } } },
  }));
  await ChapterTagFolder.bulkWrite(bulk);

  return await ChapterTagFolder.find({ owner: ownerId })
    .sort({ position: 1, createdAt: 1 })
    .lean();
}

// GET /folders?includeInactive=1
export async function listFolders(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "1";

    const filter = {
      owner: req.userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const folders = await ensurePositions(req.userId);
    const filtered = folders.filter((f) => includeInactive || f.isActive);

    filtered.sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name));

    return res.json(filtered);
  } catch (err) {
    console.error("Erro em listFolders:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// POST /folders { name, description? }
export async function createFolder(req, res) {
  try {
    const { name, description } = req.body || {};
    const cleanName = normalizeName(name);

    if (!cleanName) {
      return res.status(400).json({ error: "name é obrigatório" });
    }

    const normalizedName = normalizeKey(cleanName);

    const existing = await ChapterTagFolder.findOne({ owner: req.userId, normalizedName });
    if (existing) {
      return res.status(409).json({ error: "Já existe uma pasta com esse nome" });
    }

    const position = await nextPosition(req.userId);

    const folder = await ChapterTagFolder.create({
      name: cleanName,
      normalizedName,
      description: normalizeName(description),
      position,
      owner: req.userId,
      isActive: true,
    });

    return res.status(201).json(folder);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma pasta com esse nome" });
    }
    console.error("Erro em createFolder:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PATCH /folders/:id { name?, description?, isActive? }
export async function updateFolder(req, res) {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body || {};

    const folder = await ChapterTagFolder.findOne({ _id: id, owner: req.userId });
    if (!folder) {
      return res.status(404).json({ error: "Pasta não encontrada" });
    }

    if (name !== undefined) {
      const cleanName = normalizeName(name);
      if (!cleanName) {
        return res.status(400).json({ error: "name inválido" });
      }
      folder.name = cleanName;
      folder.normalizedName = normalizeKey(cleanName);
    }

    if (description !== undefined) {
      folder.description = normalizeName(description);
    }

    if (isActive !== undefined) {
      folder.isActive = Boolean(isActive);
    }

    await folder.save();
    return res.json(folder);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma pasta com esse nome" });
    }
    console.error("Erro em updateFolder:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// DELETE /folders/:id?moveToNone=1
export async function deleteFolder(req, res) {
  try {
    const { id } = req.params;
    const moveToNone = String(req.query.moveToNone || "").toLowerCase() === "1";

    const folder = await ChapterTagFolder.findOne({ _id: id, owner: req.userId });
    if (!folder) {
      return res.status(404).json({ error: "Pasta não encontrada" });
    }

    const tagCount = await ChapterTag.countDocuments({ owner: req.userId, folder: folder._id });

    if (tagCount > 0 && !moveToNone) {
      return res.status(400).json({
        error: "A pasta tem etiquetas. Mova-as primeiro ou use moveToNone=1 para enviar para 'Sem pasta'",
      });
    }

    if (tagCount > 0 && moveToNone) {
      await ChapterTag.updateMany({ owner: req.userId, folder: folder._id }, { $set: { folder: null } });
    }

    await folder.deleteOne();

    return res.json({ message: "Pasta apagada com sucesso" });
  } catch (err) {
    console.error("Erro em deleteFolder:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PATCH /folders/reorder { orderedIds: [] }
export async function reorderFolders(req, res) {
  try {
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];

    if (!orderedIds.length) {
      return res.status(400).json({ error: "orderedIds é obrigatório" });
    }

    const folders = await ensurePositions(req.userId);
    const folderIds = new Set(folders.map((f) => String(f._id)));

    if (orderedIds.length !== folders.length) {
      return res.status(400).json({ error: "Lista de IDs não corresponde ao total de pastas" });
    }

    for (const id of orderedIds) {
      if (!folderIds.has(String(id))) {
        return res.status(400).json({ error: "IDs inválidos ou não pertencem ao utilizador" });
      }
    }

    const bulk = orderedIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id, owner: req.userId },
        update: { $set: { position: idx } },
      },
    }));

    await ChapterTagFolder.bulkWrite(bulk);

    const updated = await ChapterTagFolder.find({ owner: req.userId })
      .sort({ position: 1, name: 1 })
      .lean();

    return res.json(updated);
  } catch (err) {
    console.error("Erro em reorderFolders:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
