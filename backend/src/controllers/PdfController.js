import zlib from "zlib";
import * as pdfParseModule from "pdf-parse";
import PdfSource from "../models/PdfSource.js";

const pdfParse = pdfParseModule.default || pdfParseModule;

function normalizeExtractedText(text) {
  // Normalização simples para melhorar chunking/recall.
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function gzipText(text) {
  return zlib.gzipSync(Buffer.from(String(text), "utf8"), { level: 9 });
}

/**
 * POST /ai/pdf/extract
 * Recebe upload multipart com campo `pdfs[]` e extrai texto.
 */
export async function extractPdfHandler(req, res) {
  const files = req.files || [];

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Falta enviar pelo menos 1 PDF" });
  }

  try {
    const created = [];

    for (const file of files) {
      const filename = file.originalname || "document.pdf";
      const buffer = file.buffer;

      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        continue;
      }

      const parsed = await pdfParse(buffer);
      const normalizedText = normalizeExtractedText(parsed.text);

      // Se o PDF não tiver texto, mantemos para que o frontend trate (mas reportamos tamanho pequeno).
      const doc = await PdfSource.create({
        userId: req.userId,
        filename,
        mimeType: file.mimetype || "",
        extractedTextGz: gzipText(normalizedText),
        extractedTextLength: normalizedText.length,
        originalSize: buffer.length,
        isActive: true,
      });

      created.push({
        id: doc._id,
        filename: doc.filename,
        extractedTextLength: doc.extractedTextLength,
      });
    }

    return res.json({ success: true, documents: created });
  } catch (err) {
    console.error("Erro em extractPdfHandler:", err);
    return res.status(500).json({ error: err?.message || "Erro ao extrair PDF" });
  }
}

/**
 * DELETE /ai/pdf/:id
 * Remove um documento extraído.
 */
export async function deletePdfHandler(req, res) {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ error: "id é obrigatório" });

    const deleted = await PdfSource.findOneAndDelete({
      _id: id,
      userId: req.userId,
    }).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Documento não encontrado" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro em deletePdfHandler:", err);
    return res.status(500).json({ error: err?.message || "Erro ao apagar PDF" });
  }
}

/**
 * DELETE /ai/pdf
 * Limpa todos os documentos extraídos do utilizador.
 */
export async function deleteAllPdfsHandler(req, res) {
  try {
    await PdfSource.deleteMany({ userId: req.userId });
    return res.json({ success: true });
  } catch (err) {
    console.error("Erro em deleteAllPdfsHandler:", err);
    return res.status(500).json({ error: err?.message || "Erro ao apagar PDFs" });
  }
}

