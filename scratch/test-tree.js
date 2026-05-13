const { Auth, Interview } = require('../src/models');
const { Op } = require('sequelize');

async function testTree() {
  const id = 6; // Mohamed Zakria
  const getAuthAttributes = () => ['id', 'fullName', 'position', 'interviewTarget', 'role'];
  
  const getRecruitmentInclude = () => ({
    model: Interview,
    as: 'managedInterviews',
    required: false,
    attributes: ['id']
  });

  const getDay1Include = () => ({
    model: Interview,
    as: 'day1Interviews',
    required: false,
    attributes: ['id']
  });

  const buildLevel = (depth) => {
    if (depth === 0) return null;
    return {
      attributes: getAuthAttributes(),
      model: Auth,
      as: 'subordinates',
      required: false,
      include: [
         getRecruitmentInclude(),
         getDay1Include(),
         buildLevel(depth - 1)
      ].filter(Boolean)
    };
  };

  const userTree = await Auth.findByPk(id, {
    attributes: getAuthAttributes(),
    include: [
       getRecruitmentInclude(),
       getDay1Include(),
       buildLevel(3)
    ].filter(Boolean)
  });

  console.log('User:', userTree.fullName);
  console.log('Subordinates raw length:', userTree.subordinates ? userTree.subordinates.length : 0);
  if (userTree.subordinates) {
    userTree.subordinates.forEach(s => console.log(' - Sub:', s.fullName));
  }
  process.exit();
}

testTree();
