const { Driver, Interview, DriverLoan, Client, Custody, CourierClearance, Auth, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.getCourierClearanceDetails = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ message: 'Courier not found' });
    }

    // Fetch existing approval record
    let approval = await CourierClearance.findOne({
      where: { driverId: id },
      include: [
        { model: Auth, as: 'operationApprover', attributes: ['id', 'fullName'] },
        { model: Auth, as: 'financeApprover', attributes: ['id', 'fullName'] },
        { model: Auth, as: 'hrApprover', attributes: ['id', 'fullName'] }
      ]
    });

    if (!approval) {
      approval = {
        driverId: id,
        operationStatus: 'pending',
        operationNotes: '',
        operationApprovedBy: null,
        operationApprovedAt: null,
        financeStatus: 'pending',
        financeNotes: '',
        financeApprovedBy: null,
        financeApprovedAt: null,
        hrStatus: 'pending',
        hrNotes: '',
        hrApprovedBy: null,
        hrApprovedAt: null,
        status: 'pending'
      };
    }

    // 1. Find all matching interviews using phone or national ID to get client contracts
    const searchConditions = [];
    if (driver.courierPhone) {
      searchConditions.push({ phoneNumber: driver.courierPhone });
    }
    if (driver.nationalId) {
      searchConditions.push({ nationalId: driver.nationalId });
    }

    let interviews = [];
    if (searchConditions.length > 0) {
      interviews = await Interview.findAll({
        where: {
          [Op.or]: searchConditions,
        },
        include: [
          {
            model: Client,
            as: 'client',
            attributes: ['id', 'name', 'clearancePeriodDays'],
          },
        ],
        order: [['date', 'DESC']],
      });
    }

    // 2. Fetch outstanding loans (approved or disbursed, unpaid balance > 0)
    const loans = await DriverLoan.findAll({
      where: {
        driverId: id,
        status: {
          [Op.in]: ['approved', 'disbursed'],
        },
      },
    });

    const outstandingLoans = loans.map(loan => {
      const amount = parseFloat(loan.amount) || 0;
      const paidAmount = parseFloat(loan.paidAmount) || 0;
      const balance = amount - paidAmount;
      return {
        id: loan.id,
        amount,
        paidAmount,
        balance,
        status: loan.status,
        date: loan.createdAt,
      };
    }).filter(loan => loan.balance > 0);

    const hasUnpaidLoans = outstandingLoans.length > 0;
    const totalOutstandingLoansBalance = outstandingLoans.reduce((sum, loan) => sum + loan.balance, 0);

    // 2b. Fetch Custodies
    const driverCustodies = await Custody.findAll({
      where: { driverId: id }
    });

    const custodiesList = driverCustodies.map(c => ({
      id: c.id,
      custodyType: c.custodyType,
      deliveryDate: c.deliveryDate,
      status: c.status,
      returnDate: c.returnDate,
      replacementDate: c.replacementDate,
      notes: c.notes
    }));

    const hasUnreturnedCustody = driverCustodies.some(c => c.status !== 'returned');

    // 3. Map each client contract/interview details
    const contracts = interviews.map(interview => {
      const client = interview.client || {};
      const clearancePeriodDays = client.clearancePeriodDays !== undefined ? client.clearancePeriodDays : 30;
      
      let daysElapsed = 0;
      let eligibleByHoldPeriod = true;
      let remainingDays = 0;

      if (driver.inactiveDate) {
        const inactiveDateObj = new Date(driver.inactiveDate);
        const todayObj = new Date();
        const diffTime = Math.abs(todayObj - inactiveDateObj);
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        eligibleByHoldPeriod = daysElapsed >= clearancePeriodDays;
        remainingDays = Math.max(0, clearancePeriodDays - daysElapsed);
      } else {
        eligibleByHoldPeriod = false;
        daysElapsed = 0;
        remainingDays = clearancePeriodDays;
      }

      return {
        interviewId: interview.id,
        clientName: client.name || 'Unknown Client',
        clientId: client.id || null,
        trustReceiptsCount: interview.trustReceiptsCount || 0,
        trustReceiptsAmount: parseFloat(interview.trustReceiptsAmount) || 0,
        clearancePeriodDays,
        daysElapsed,
        eligibleByHoldPeriod,
        remainingDays,
      };
    });

    const isInactive = !!driver.inactiveDate;
    const allHoldPeriodsSatisfied = contracts.length > 0 ? contracts.every(c => c.eligibleByHoldPeriod) : true;
    const delayBalance = Number(driver.delayBalance) || 0;
    const hasDelay = delayBalance > 0;
    const overallEligible = isInactive && allHoldPeriodsSatisfied && !hasUnpaidLoans && !hasUnreturnedCustody && !hasDelay;

    return res.json({
      courier: {
        id: driver.id,
        name: driver.name,
        phone: driver.courierPhone,
        nationalId: driver.nationalId,
        hiringStatus: driver.hiringStatus,
        contractStatus: driver.contractStatus,
        inactiveDate: driver.inactiveDate,
        isInactive,
      },
      contracts,
      outstandingLoans,
      hasUnpaidLoans,
      totalOutstandingLoansBalance,
      delayBalance,
      hasDelay,
      custodies: custodiesList,
      hasUnreturnedCustody,
      overallEligible,
      approval
    });

  } catch (error) {
    console.error('getCourierClearanceDetails error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.submitClearanceApproval = async (req, res) => {
  try {
    const driverId = Number(req.params.id);
    const { step, action, notes } = req.body; // step: 'operation' | 'finance' | 'hr', action: 'approve' | 'reject'

    if (!['operation', 'finance', 'hr'].includes(step)) {
      return res.status(400).json({ message: 'Invalid step parameter' });
    }
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action parameter' });
    }

    const driver = await Driver.findByPk(driverId);
    if (!driver) return res.status(404).json({ message: 'Courier not found' });

    let approval = await CourierClearance.findOne({ where: { driverId } });
    if (!approval) {
      approval = await CourierClearance.create({
        driverId,
        status: 'pending'
      });
    }

    const userRole = req.user.role;
    const userPosition = req.user.position;
    const userId = req.user.id;

    if (step === 'operation') {
      const isAllowed = userRole === 'admin' || ((userRole === 'operation' || userRole === 'poc') && userPosition === 'manager');
      if (!isAllowed) {
        return res.status(403).json({ message: 'Only Operation Managers or Admin can approve this step.' });
      }
      
      approval.operationStatus = action === 'approve' ? 'approved' : 'rejected';
      approval.operationApprovedBy = userId;
      approval.operationNotes = notes || '';
      approval.operationApprovedAt = new Date();
      
      // Reset subsequent approvals if operation is changed
      approval.financeStatus = 'pending';
      approval.financeApprovedBy = null;
      approval.financeApprovedAt = null;
      approval.hrStatus = 'pending';
      approval.hrApprovedBy = null;
      approval.hrApprovedAt = null;

      approval.status = action === 'approve' ? 'pending' : 'rejected';
    } 
    
    else if (step === 'finance') {
      const isAllowed = userRole === 'admin' || (userRole === 'finance' && userPosition === 'manager');
      if (!isAllowed) {
        return res.status(403).json({ message: 'Only Finance Managers or Admin can approve this step.' });
      }
      if (approval.operationStatus !== 'approved') {
        return res.status(400).json({ message: 'Operation approval is required before Finance approval.' });
      }

      approval.financeStatus = action === 'approve' ? 'approved' : 'rejected';
      approval.financeApprovedBy = userId;
      approval.financeNotes = notes || '';
      approval.financeApprovedAt = new Date();
      
      // Reset subsequent approvals
      approval.hrStatus = 'pending';
      approval.hrApprovedBy = null;
      approval.hrApprovedAt = null;

      approval.status = action === 'approve' ? 'pending' : 'rejected';
    } 
    
    else if (step === 'hr') {
      const isAllowed = userRole === 'admin' || userRole === 'hr';
      if (!isAllowed) {
        return res.status(403).json({ message: 'Only HR or Admin can approve this step.' });
      }
      if (approval.operationStatus !== 'approved' || approval.financeStatus !== 'approved') {
        return res.status(400).json({ message: 'Both Operation and Finance approvals are required before HR approval.' });
      }

      // Check validation criteria for final clearance release
      const loans = await DriverLoan.findAll({
        where: { driverId, status: { [Op.in]: ['approved', 'disbursed'] } }
      });
      const unpaidLoans = loans.some(loan => (parseFloat(loan.amount) || 0) - (parseFloat(loan.paidAmount) || 0) > 0);
      
      const driverCustodies = await Custody.findAll({ where: { driverId } });
      const unreturnedCustody = driverCustodies.some(c => c.status !== 'returned');

      if (!driver.inactiveDate) {
        return res.status(400).json({ message: 'Courier must be inactive to complete clearance.' });
      }
      if (unpaidLoans) {
        return res.status(400).json({ message: 'Cannot clear courier: outstanding loans exist.' });
      }
      if (Number(driver.delayBalance) > 0) {
        return res.status(400).json({ message: 'Cannot clear courier: outstanding delay balance exists.' });
      }
      if (unreturnedCustody) {
        return res.status(400).json({ message: 'Cannot clear courier: unreturned custodies exist.' });
      }

      approval.hrStatus = action === 'approve' ? 'approved' : 'rejected';
      approval.hrApprovedBy = userId;
      approval.hrNotes = notes || '';
      approval.hrApprovedAt = new Date();

      if (action === 'approve') {
        approval.status = 'approved';
        driver.contractStatus = 'inactive'; // mark cleared
        await driver.save();
      } else {
        approval.status = 'rejected';
      }
    }

    await approval.save();

    const reloaded = await CourierClearance.findOne({
      where: { driverId },
      include: [
        { model: Auth, as: 'operationApprover', attributes: ['id', 'fullName'] },
        { model: Auth, as: 'financeApprover', attributes: ['id', 'fullName'] },
        { model: Auth, as: 'hrApprover', attributes: ['id', 'fullName'] }
      ]
    });

    return res.json({ message: 'Clearance step updated successfully', approval: reloaded });
  } catch (error) {
    console.error('submitClearanceApproval error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
