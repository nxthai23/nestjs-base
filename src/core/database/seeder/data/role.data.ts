export const roleData = [
  {
    name: 'admin',
    permissions: [{ action: 'manage', subject: 'all' }],
  },
  {
    name: 'user',
    permissions: [
      { action: 'read', subject: 'User', conditions: { id: '$id' } },
      { action: 'update', subject: 'User', conditions: { id: '$id' } },
      { action: 'delete', subject: 'User', conditions: { id: '$id' } },
    ],
  },
];
