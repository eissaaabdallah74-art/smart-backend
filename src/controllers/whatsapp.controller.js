const whatsappService = require("../services/whatsapp.service");
const QRCode = require("qrcode");
const db = require("../models");
const WhatsappTemplate = db.WhatsappTemplate;

exports.getStatus = async (req, res) => {
  try {
    const statusObj = whatsappService.getStatus();
    
    // Convert text QR directly into a base64 Data URL for the frontend
    if (statusObj.status === 'NEEDS_QR' && statusObj.qr) {
      statusObj.qrCodeDataUrl = await QRCode.toDataURL(statusObj.qr);
    }
    
    return res.json(statusObj);
  } catch (err) {
    return res.status(500).json({ message: "Failed to get status", error: err.message });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const progress = whatsappService.getProgress();
    return res.json(progress);
  } catch (err) {
    return res.status(500).json({ message: "Failed to get progress", error: err.message });
  }
};

exports.connect = (req, res) => {
  try {
    if (whatsappService.status === 'DISCONNECTED') {
      whatsappService.initialize();
      return res.json({ message: "Initialization started..." });
    }
    return res.json({ message: "Already connected or initializing." });
  } catch (err) {
    return res.status(500).json({ message: "Failed to initialize", error: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    await whatsappService.logout();
    return res.json({ message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to logout", error: err.message });
  }
};

exports.sendBulk = async (req, res) => {
  try {
    const { drivers, groupId, delayType, minDelay, maxDelay } = req.body;

    if (!drivers || drivers.length === 0) {
      return res.status(400).json({ message: "No drivers provided" });
    }

    if (!groupId) {
      return res.status(400).json({ message: "Template group is required" });
    }

    // Fetch templates directly from DB for this group
    const templates = await WhatsappTemplate.findAll({ where: { groupId } });
    if (!templates || templates.length === 0) {
      return res.status(400).json({ message: "No templates found for this group" });
    }

    // Pass to service which processes asynchronously immediately.
    whatsappService.sendBulk(drivers, templates, delayType, minDelay, maxDelay);

    return res.json({ message: "Bulk sending process has been queued and started in the background." });
  } catch (err) {
    console.error("Bulk Send Error:", err);
    return res.status(500).json({ message: "Failed to start bulk send", error: err.message });
  }
};
