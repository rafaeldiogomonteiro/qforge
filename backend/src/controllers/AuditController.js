import AuditLog from "../models/AuditLog.js";

// GET /audit-logs
export async function listAuditLogs(req, res) {
  try {
    const { page = 1, limit = 20, action, userId } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);

    const filter = { userId: req.userId };

    if (action && action !== "Todas as ações") {
      filter.action = action;
    }

    const total = await AuditLog.countDocuments(filter);

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("userId", "name email");

    res.json({
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("Erro em listAuditLogs:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// POST /audit-logs (uso interno apenas)
export async function createAuditLog(req, res) {
  try {
    const { action, targetType, targetId, targetName, details, result, errorMessage } = req.body;

    if (!action || !targetType) {
      return res.status(400).json({ error: "action e targetType são obrigatórios" });
    }

    const log = await AuditLog.create({
      userId: req.userId,
      action,
      targetType,
      targetId,
      targetName,
      details,
      result: result || "Sucesso",
      errorMessage,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    res.status(201).json(log);
  } catch (err) {
    console.error("Erro em createAuditLog:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// GET /audit-logs/stats
export async function getAuditStats(req, res) {
  try {
    const stats = await AuditLog.aggregate([
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const successRate = await AuditLog.aggregate([
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: "$result",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      actionStats: stats,
      successRate
    });
  } catch (err) {
    console.error("Erro em getAuditStats:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
