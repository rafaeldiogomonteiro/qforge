import QuestionBank from "../models/QuestionBank.js";
import Question from "../models/Question.js";
import AuditLog from "../models/AuditLog.js";

// GET /dashboard/stats
export async function getDashboardStats(req, res) {
  try {
    const userId = req.userId;

    const banks = await QuestionBank.find({ owner: userId })
      .select("_id")
      .lean();
    const bankIds = banks.map((b) => b._id);

    const activeBanksCount = bankIds.length;
    const questionsCount = bankIds.length
      ? await Question.countDocuments({ bank: { $in: bankIds } })
      : 0;
    const aiQuestionsCount = bankIds.length
      ? await Question.countDocuments({
          bank: { $in: bankIds },
          source: "AI",
        })
      : 0;

    const aiGenerationsCount = await AuditLog.countDocuments({
      userId,
      action: "Geração IA",
    });

    const totalAudit = await AuditLog.countDocuments({ userId });
    const successAudit = await AuditLog.countDocuments({
      userId,
      result: "Sucesso",
    });
    const successRate =
      totalAudit > 0 ? ((successAudit / totalAudit) * 100).toFixed(1) : "0.0";

    res.json({
      banksActive: activeBanksCount,
      usersCount: 1, // por ora: stats por utilizador (self-contained). Pode evoluir para colaboradores.
      testsGenerated: aiGenerationsCount,
      successRate: `${successRate}%`,
      aiQuestionsCount,
      questionsCount,
    });
  } catch (err) {
    console.error("Erro em getDashboardStats:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

