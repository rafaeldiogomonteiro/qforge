import ChapterTag from "../models/ChapterTag.js";

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeKey(name) {
  return normalizeName(name).toLowerCase();
}

// GET /chapter-tags?includeInactive=1
export async function listChapterTags(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "1";

    const filter = {
      owner: req.userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const tags = await ChapterTag.find(filter)
      .sort({ name: 1 })
      .lean();

    res.json(tags);
  } catch (err) {
    console.error("Erro em listChapterTags:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// POST /chapter-tags { name }
// Idempotente: se já existir (normalizedName), devolve o existente
export async function createChapterTag(req, res) {
  try {
    const { name } = req.body || {};
    const cleanName = normalizeName(name);

    if (!cleanName) {
      return res.status(400).json({ error: "name é obrigatório" });
    }

    const normalizedName = normalizeKey(cleanName);

    const existing = await ChapterTag.findOne({ owner: req.userId, normalizedName });
    if (existing) {
      if (existing.isActive === false) {
        existing.isActive = true;
        await existing.save();
        return res.status(200).json(existing);
      }
      return res.status(409).json({ error: "Essa Tag já existe" });
    }

    const tag = await ChapterTag.create({
      name: cleanName,
      normalizedName,
      isActive: true,
      owner: req.userId,
    });

    return res.status(201).json(tag);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma tag com esse nome" });
    }
    console.error("Erro em createChapterTag:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PUT /chapter-tags/:id { name?, isActive? }
export async function updateChapterTag(req, res) {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body || {};

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

    if (isActive !== undefined) {
      tag.isActive = Boolean(isActive);
    }

    await tag.save();
    res.json(tag);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma tag com esse nome" });
    }
    console.error("Erro em updateChapterTag:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// DELETE /chapter-tags/:id (soft delete)
export async function deleteChapterTag(req, res) {
  try {
    const { id } = req.params;

    const tag = await ChapterTag.findOne({ _id: id, owner: req.userId });
    if (!tag) {
      return res.status(404).json({ error: "Tag não encontrada" });
    }

    tag.isActive = false;
    await tag.save();

    res.json({ message: "Tag desativada com sucesso" });
  } catch (err) {
    console.error("Erro em deleteChapterTag:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
