import Label from "../models/Label.js";

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeKey(name) {
  return normalizeName(name).toLowerCase();
}

// GET /labels?includeInactive=1
export async function listLabels(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "1";

    const filter = includeInactive ? {} : { isActive: true };

    const labels = await Label.find(filter)
      .sort({ name: 1 })
      .lean();

    res.json(labels);
  } catch (err) {
    console.error("Erro em listLabels:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// POST /labels { name }
// Idempotente: se já existir (normalizedName), devolve o existente
export async function createLabel(req, res) {
  try {
    const { name } = req.body || {};
    const cleanName = normalizeName(name);

    if (!cleanName) {
      return res.status(400).json({ error: "name é obrigatório" });
    }

    const normalizedName = normalizeKey(cleanName);

    const label = await Label.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { name: cleanName, normalizedName, isActive: true } },
      { new: true, upsert: true }
    );

    // Se já existia mas estava inativa, reativa
    if (label && label.isActive === false) {
      label.isActive = true;
      await label.save();
    }

    // Não é trivial saber se foi insert sem rawResult; devolvemos 200/201? Mantemos 200.
    return res.status(200).json(label);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma label com esse nome" });
    }
    console.error("Erro em createLabel:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PUT /labels/:id { name?, isActive? }
export async function updateLabel(req, res) {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body || {};

    const label = await Label.findById(id);
    if (!label) {
      return res.status(404).json({ error: "Label não encontrada" });
    }

    if (name !== undefined) {
      const cleanName = normalizeName(name);
      if (!cleanName) {
        return res.status(400).json({ error: "name inválido" });
      }
      label.name = cleanName;
      label.normalizedName = normalizeKey(cleanName);
    }

    if (isActive !== undefined) {
      label.isActive = Boolean(isActive);
    }

    await label.save();
    res.json(label);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Já existe uma label com esse nome" });
    }
    console.error("Erro em updateLabel:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// DELETE /labels/:id (soft delete)
export async function deleteLabel(req, res) {
  try {
    const { id } = req.params;

    const label = await Label.findById(id);
    if (!label) {
      return res.status(404).json({ error: "Label não encontrada" });
    }

    label.isActive = false;
    await label.save();

    res.json({ message: "Label desativada com sucesso" });
  } catch (err) {
    console.error("Erro em deleteLabel:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
