const { FinanceCategory } = require('../models');

module.exports = async () => {
    const categories = [
        { name: 'Salaries', type: 'expense', description: 'Employee and Driver salaries' },
        { name: 'Office Rent', type: 'expense', description: 'Monthly office rent' },
        { name: 'Electricity', type: 'expense', description: 'Electricity bills' },
        { name: 'Water', type: 'expense', description: 'Water bills' },
        { name: 'Internet', type: 'expense', description: 'Internet and communication' },
        { name: 'Marketing', type: 'expense', description: 'Marketing and advertising' },
        { name: 'Client Payment', type: 'revenue', description: 'Payments received from clients' },
        { name: 'Other Revenue', type: 'revenue', description: 'Miscellaneous revenue' },
    ];

    for (const cat of categories) {
        await FinanceCategory.findOrCreate({
            where: { name: cat.name },
            defaults: cat
        });
    }

    console.log('✅ Finance categories seeded');
};
