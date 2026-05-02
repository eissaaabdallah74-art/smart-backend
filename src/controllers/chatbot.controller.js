const {
    Employee, Driver, AttendanceMonthlySummary, FinanceTransaction,
    FinanceCategory, Payroll, EmployeeEmployment, EmployeePayrollInsurance,
    Client, Vendor, Task, EmployeeLoan, sequelize
} = require('../models');
const { Op } = require('sequelize');
const AIService = require('../services/ai.service');

/**
 * Chatbot Controller - V8 (Deep Employee Profiles + Dynamic Linking)
 * Provides detailed data about employees, drivers, and system entities.
 */ 
exports.ask = async (req, res) => {
    try {
        const { message } = req.body;
        const user = req.user;

        console.log(`[Chatbot V8] Message: "${message}"`);

        if (!message) return res.status(400).json({ message: 'Input message is required' });

        const query = message.toLowerCase().trim();
        let response = {
            answer: null,
            suggestions: []
        };

        const isAdmin = user.role === 'admin';
        const isHR = user.role === 'hr';
        const isFinance = user.role === 'finance';

        // --- A. DYNAMIC ENTITY DETECTION & DATA FETCHING ---
        let contextData = '';

        // Check for CLIENTS (عملاء)
        if (query.includes('عملا') || query.includes('زبائن') || query.includes('client')) {
            const clients = await Client.findAll({ attributes: ['id', 'name', 'contactEmail', 'isActive'], limit: 10 });
            contextData += AIService.formatGenericList('العملاء', clients, ['id', 'name', 'contactEmail', 'isActive']);
        }

        // Check for VENDORS (موردين)
        if (query.includes('مورد') || query.includes('vendor')) {
            const vendors = await Vendor.findAll({ attributes: ['id', 'name', 'code'], limit: 10 });
            contextData += AIService.formatGenericList('الموردين', vendors, ['id', 'name', 'code']);
        }

        // Check for EMPLOYEES / DEPARTMENTS (موظفين / أقسام)
        if (query.includes('موظف') || query.includes('قسم') || query.includes('crm') || query.includes('hr') || query.includes('finance') || query.includes('شغال')) {
            let deptWhere = {};
            if (query.includes('crm')) deptWhere = { department: 'CRM' };
            else if (query.includes('hr')) deptWhere = { department: 'HR' };
            else if (query.includes('finance')) deptWhere = { department: 'Finance' };
            else if (query.includes('operation')) deptWhere = { department: 'Operation' };

            const emps = await Employee.findAll({
                include: [{
                    model: EmployeeEmployment,
                    as: 'employment',
                    where: Object.keys(deptWhere).length > 0 ? deptWhere : undefined,
                    required: Object.keys(deptWhere).length > 0
                }],
                limit: 20
            });

            if (emps.length > 0) {
                const mapped = emps.map(e => ({
                    id: e.id,
                    name: e.fullName,
                    dept: e.employment?.department,
                    title: e.employment?.jobTitle
                }));
                contextData += AIService.formatGenericList('الموظفين المطابقين للبحث', mapped, ['id', 'name', 'dept', 'title']);
            }
        }

        // Check for ATTENDANCE (غياب/حضور)
        if (query.includes('غياب') || query.includes('غايب') || query.includes('حضور') || query.includes('بصمة')) {
            const absentees = await AttendanceMonthlySummary.findAll({
                where: { absentDays: { [Op.gt]: 0 } },
                include: [{ model: Employee, as: 'employee', attributes: ['fullName'] }],
                limit: 10
            });
            const mapped = absentees.map(a => ({ name: a.employee?.fullName, days: a.absentDays }));
            contextData += AIService.formatGenericList('سجل الغياب (أعلى أيام غياب)', mapped, ['name', 'days']);
        }

        // Check for FINANCE (مالية/حسابات)
        if (isAdmin || isFinance) {
            if (query.includes('مالية') || query.includes('حسابات') || query.includes('ايراد') || query.includes('مصروف')) {
                const transactions = await FinanceTransaction.findAll({
                    limit: 10, order: [['createdAt', 'DESC']],
                    include: [{ model: FinanceCategory, as: 'category' }]
                });
                const mapped = transactions.map(t => ({
                    amount: `${t.amount} ${t.category?.type === 'expense' ? '▼' : '▲'}`,
                    cat: t.category?.name,
                    desc: t.description
                }));
                contextData += AIService.formatGenericList('أحدث المعاملات المالية', mapped, ['amount', 'cat', 'desc']);
            }
        }

        // Check for TASKS (تاسكات/مهام)
        if (query.includes('تاسك') || query.includes('مهم') || query.includes('شغل')) {
            const tasks = await Task.findAll({ where: { status: { [Op.ne]: 'completed' } }, limit: 10 });
            contextData += AIService.formatGenericList('المهام (Tasks)', tasks.map(t => ({ title: t.title, priority: t.priority, status: t.status })), ['title', 'priority', 'status']);
        }

        // --- B. INDIVIDUAL SEARCH (ID / NAME) ---
        const idMatch = query.match(/(\d+)/);
        if (idMatch && (query.includes('رقم') || query.includes('id') || query.length < 5)) {
            const targetId = idMatch[1];
            const [emp, drv] = await Promise.all([
                Employee.findByPk(targetId, { include: [{ model: EmployeeEmployment, as: 'employment' }, { model: EmployeePayrollInsurance, as: 'payrollInsurance' }] }),
                Driver.findByPk(targetId)
            ]);
            if (emp) contextData += AIService.formatEmployeeContext(emp);
            if (drv) contextData += AIService.formatDriverContext(drv);
        } else {
            const prefixes = ['موظف', 'سائق', 'مورد', 'عميل', 'اسمه', 'باسم', 'بيانات', 'عن', 'هو'];
            let namePart = query;
            prefixes.forEach(p => {
                const regex = new RegExp(`^${p}\\s+|\\s+${p}\\s+|\\s+${p}$`, 'gi');
                namePart = namePart.replace(regex, ' ').trim();
            });

            if (namePart.length >= 2) {
                const [emp, drv] = await Promise.all([
                    Employee.findOne({ where: { fullName: { [Op.like]: `%${namePart}%` } }, include: [{ model: EmployeeEmployment, as: 'employment' }, { model: EmployeePayrollInsurance, as: 'payrollInsurance' }] }),
                    Driver.findOne({ where: { [Op.or]: [{ name: { [Op.like]: `%${namePart}%` } }, { fullNameArabic: { [Op.like]: `%${namePart}%` } }] } })
                ]);
                if (emp) contextData += AIService.formatEmployeeContext(emp);
                if (drv) contextData += AIService.formatDriverContext(drv);
            }
        }

        // --- C. STATS CONTEXT (Always included) ---
        const [empCount, drvCount, cliCount] = await Promise.all([Employee.count(), Driver.count(), Client.count()]);
        contextData += `\nإحصائيات النظام العامة: الموظفين=${empCount}، السائقين=${drvCount}، العملاء=${cliCount}.\n`;

        // --- D. LLAMA 3 FINAL ANSWER ---
        const aiResponse = await AIService.askGeneric(message, contextData);

        response.answer = aiResponse;
        response.suggestions = ['موظفين الـ CRM', 'ملخص المالية', 'قائمة العملاء', 'المهام المعلقة'];

        return res.json(response);
    } catch (error) {
        console.error('[Chatbot V8 Error]:', error);
        return res.status(500).json({
            message: 'حدث خطأ في قراءة البيانات. جرب مرة أخرى.',
            detail: error.message
        });
    }
};