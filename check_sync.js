const { Interview, Driver } = require('./src/models');

async function checkSync() {
  try {
    const lastInterview = await Interview.findOne({
      order: [['id', 'DESC']],
      include: ['client', 'vendor']
    });

    if (!lastInterview) {
      console.log('No interviews found.');
      return;
    }

    console.log('Last Interview Details:', {
      id: lastInterview.id,
      courierName: lastInterview.courierName,
      phoneNumber: lastInterview.phoneNumber,
      nationalId: lastInterview.nationalId,
      vendorName: lastInterview.vendor?.name,
      clientId: lastInterview.clientId,
      pointOfContact: lastInterview.client?.pointOfContact
    });

    const normalizedPhone = lastInterview.phoneNumber.replace(/[^\d]/g, '');
    const driver = await Driver.findOne({
      where: { courierPhone: normalizedPhone }
    });

    if (!driver) {
      console.log('No driver found for phone:', normalizedPhone);
    } else {
      console.log('Found Driver:', {
        id: driver.id,
        name: driver.name,
        courierPhone: driver.courierPhone,
        courierId: driver.courierId, // This is nationalId
        contractor: driver.contractor
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkSync();
