const {
    Payroll, Employee, Driver, EmployeePayrollInsurance,
    AttendanceMonthlySummary, LoanInstallment, FinanceTransaction,
    FinanceCategory, sequelize
} = require('../models');
const { Op } = require('sequelize');

exports.getAllPayrolls = async (req, res) => {
    try {
        const { month, year, type, status } = req.query;
        const where = {};
        if (month) where.month = month;
        if (year) where.year = year;
        if (status) where.status = status;

        if (type === 'employee') {
            where.employeeId = { [Op.ne]: null };
        } else if (type === 'driver') {
            where.driverId = { [Op.ne]: null };
        }

        const payrolls = await Payroll.findAll({
            where,
            include: [
                { model: Employee, as: 'employee', attributes: ['fullName'] },
                { model: Driver, as: 'driver', attributes: ['name'] }
            ],
            order: [['year', 'DESC'], ['month', 'DESC'], ['id', 'ASC']]
        });

        return res.json(payrolls);
    } catch (error) {
        console.error('getAllPayrolls error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.generatePayroll = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { month, year, type } = req.body;
        if (!month || !year || !type) {
            return res.status(400).json({ message: 'month, year, and type are required' });
        }

        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        if (type === 'employee') {
            const employees = await Employee.findAll({
                include: [
                    { model: EmployeePayrollInsurance, as: 'payrollInsurance' }
                ],
                transaction: t
            });

            for (const emp of employees) {
                // Fetch attendance calculation (The user stated this is the primary source)
                const attendanceSummary = await AttendanceMonthlySummary.findOne({
                    where: { employeeId: emp.id, month: monthStr },
                    transaction: t
                });

                let grossSalary = 0;
                let attendanceDeduction = 0;

                if (attendanceSummary) {
                    grossSalary = Number(attendanceSummary.salaryGrossUsed) || 0;
                    attendanceDeduction = Number(attendanceSummary.deductionAmount) || 0;
                } else {
                    grossSalary = emp.payrollInsurance?.grossSalary || 0;
                }

                // Fetch loan installments
                const loanInstallment = await LoanInstallment.findOne({
                    where: { employeeId: emp.id, month: monthStr, status: 'pending' },
                    transaction: t
                });
                const loanDeduction = loanInstallment ? Number(loanInstallment.amount) : 0;

                const totalDeductions = attendanceDeduction + loanDeduction;
                const netSalary = Math.max(grossSalary - totalDeductions, 0);

                await Payroll.upsert({
                    employeeId: emp.id,
                    month,
                    year,
                    basicSalary: grossSalary,
                    allowances: 0,
                    deductions: totalDeductions,
                    netSalary: netSalary,
                    status: 'pending'
                }, { transaction: t });

                // Note: We don't mark loan as deducted yet. 
                // We do that when the payroll is marked as PAID.
            }
        } else if (type === 'driver') {
            const drivers = await Driver.findAll({ transaction: t });
            for (const driver of drivers) {
                const salary = Number(driver.monthlySalary) || 0;
                // Basic calculation for drivers for now
                await Payroll.upsert({
                    driverId: driver.id,
                    month,
                    year,
                    basicSalary: salary,
                    allowances: 0,
                    deductions: 0,
                    netSalary: salary,
                    status: 'pending'
                }, { transaction: t });
            }
        }

        await t.commit();
        return res.json({ message: 'Payroll generated successfully' });
    } catch (error) {
        await t.rollback();
        console.error('generatePayroll error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.markAsPaid = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const payroll = await Payroll.findByPk(id, {
            include: [
                { model: Employee, as: 'employee' },
                { model: Driver, as: 'driver' }
            ],
            transaction: t
        });

        if (!payroll) {
            await t.rollback();
            return res.status(404).json({ message: 'Payroll not found' });
        }

        if (payroll.status === 'paid') {
            await t.rollback();
            return res.status(400).json({ message: 'Payroll already paid' });
        }

        // 1. Update status
        payroll.status = 'paid';
        payroll.paymentDate = new Date();
        await payroll.save({ transaction: t });

        // 2. Create Finance Transaction
        let category = await FinanceCategory.findOne({
            where: { name: 'Salaries', type: 'expense' },
            transaction: t
        });
        if (!category) {
            category = await FinanceCategory.create({
                name: 'Salaries',
                type: 'expense',
                description: 'Employee and Driver salaries'
            }, { transaction: t });
        }

        const name = payroll.employee ? payroll.employee.fullName : payroll.driver.name;
        await FinanceTransaction.create({
            categoryId: category.id,
            amount: payroll.netSalary,
            transactionDate: new Date(),
            description: `Salary for ${name} - ${payroll.month}/${payroll.year}`,
            referenceId: payroll.id,
            referenceType: 'Payroll',
            createdById: req.user?.id
        }, { transaction: t });

        // 3. Update Loan Installments if any
        if (payroll.employeeId) {
            const monthStr = `${payroll.year}-${String(payroll.month).padStart(2, '0')}`;
            const loanInstallment = await LoanInstallment.findOne({
                where: { employeeId: payroll.employeeId, month: monthStr, status: 'pending' },
                transaction: t
            });
            if (loanInstallment) {
                loanInstallment.status = 'deducted';
                loanInstallment.deductedAt = new Date();
                loanInstallment.payrollRunId = payroll.id;
                await loanInstallment.save({ transaction: t });
            }
        }

        await t.commit();
        return res.json({ message: 'Payroll marked as paid' });
    } catch (error) {
        await t.rollback();
        console.error('markAsPaid error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
