const { Client, LocalAuth } = require('whatsapp-web.js');

class WhatsappService {
  constructor() {
    this.client = null;
    this.qrCode = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED, NEEDS_QR, CONNECTED
    this.isInitializing = false;
    this.campaignProgress = {
      isActive: false,
      total: 0,
      sent: 0,
      failed: 0,
      currentDriverName: null
    };
  }

  getProgress() {
    return this.campaignProgress;
  }

  initialize() {
    if (this.isInitializing || this.status === 'CONNECTED') return;
    this.isInitializing = true;
    this.status = 'INITIALIZING';

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
      }
    });

    this.client.on('qr', (qr) => {
      console.log('WhatsApp QR Code generated.');
      this.qrCode = qr;
      this.status = 'NEEDS_QR';
    });

    this.client.on('ready', () => {
      console.log('WhatsApp is ready!');
      this.qrCode = null;
      this.status = 'CONNECTED';
      this.isInitializing = false;
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp Authenticated.');
    });

    this.client.on('auth_failure', msg => {
      console.error('WhatsApp Authentication failure', msg);
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp was disconnected:', reason);
      this.status = 'DISCONNECTED';
      this.client = null;
      this.isInitializing = false;
    });

    this.client.initialize().catch(err => {
      console.error('WhatsApp Initialization error', err);
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
    });
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.status === 'NEEDS_QR' ? this.qrCode : null
    };
  }

  logout() {
    return new Promise((resolve, reject) => {
      if (this.client) {
        this.client.logout().then(() => {
          this.status = 'DISCONNECTED';
          resolve();
        }).catch(reject);
      } else {
        this.status = 'DISCONNECTED';
        resolve();
      }
    });
  }

  async sendBulk(drivers, templates, delayType, minDelay, maxDelay) {
    if (this.status !== 'CONNECTED' || !this.client) {
      throw new Error('WhatsApp is not connected.');
    }

    if (!templates || templates.length === 0) {
      throw new Error('No templates available.');
    }

    // Function to generate a random delay
    const getDelay = () => {
      if (delayType === 'fixed') {
        return minDelay * 1000;
      } else {
        // Random between minDelay and maxDelay
        const min = minDelay * 1000;
        const max = maxDelay * 1000;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Set progress state
    this.campaignProgress = {
      isActive: true,
      total: drivers.length,
      sent: 0,
      failed: 0,
      currentDriverName: null
    };

    // Send in background to not block the request
    (async () => {
      for (const driver of drivers) {
        try {
          if (!driver.phone) {
            this.campaignProgress.failed++;
            continue;
          }

          this.campaignProgress.currentDriverName = driver.name || driver.phone;

          // Format phone (add country code if missing, strip spaces)
          // Adjust this formatting based on the target country (Egypt usually +20)
          let phone = driver.phone.replace(/\D/g, '');
          if (phone.startsWith('01')) {
            phone = '2' + phone; 
          }
          const chatId = `${phone}@c.us`;

          // Pick a random template
          const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
          const content = randomTemplate.content;

          // Replace variables like {{name}}
          let messageStr = content;
          if (messageStr) {
            messageStr = messageStr.replace(/\{\{name\}\}/gi, driver.name || 'عزيزي المندوب');
            messageStr = messageStr.replace(/\{\{phone\}\}/gi, driver.phone || '');
            messageStr = messageStr.replace(/\{\{vehicle\}\}/gi, driver.vehicle || '');
          }

          // Send message
          console.log(`Sending to ${phone}...`);
          await this.client.sendMessage(chatId, messageStr);

          this.campaignProgress.sent++;

          // Delay before next message
          const delayMs = getDelay();
          console.log(`Waiting for ${delayMs}ms before next message...`);
          await sleep(delayMs);

        } catch (err) {
          console.error(`Failed to send message to ${driver.phone}:`, err);
          this.campaignProgress.failed++;
        }
      }
      console.log('Bulk send completed.');
      this.campaignProgress.isActive = false;
      this.campaignProgress.currentDriverName = null;
    })();
  }
}

// Export singleton instance
const whatsappService = new WhatsappService();
module.exports = whatsappService;
