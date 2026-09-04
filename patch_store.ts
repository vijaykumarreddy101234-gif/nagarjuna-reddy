import fs from 'fs';
let content = fs.readFileSync('store/useStore.ts', 'utf-8');

if (!content.includes('AppUser')) {
    content = content.replace("DataPlanRow } from '../types';", "DataPlanRow, AppUser } from '../types';");
}

if (!content.includes('appUsers: AppUser[]')) {
    // Insert state typing
    content = content.replace("currentUser: User | null;", "currentUser: User | null;\n    appUsers: AppUser[];\n    addAppUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;\n    updateAppUser: (user: AppUser) => void;\n    deleteAppUser: (id: string) => void;");
    
    // Insert initial state
    content = content.replace("currentUser: null,", "currentUser: null,\n      appUsers: [],");
    
    // Insert actions
    const actions = `
      addAppUser: (user) => set(state => ({ appUsers: [...state.appUsers, { ...user, id: \`u\${Date.now()}\`, createdAt: new Date().toISOString() }] })),
      updateAppUser: (user) => set(state => ({ appUsers: state.appUsers.map(u => u.id === user.id ? user : u) })),
      deleteAppUser: (id) => set(state => ({ appUsers: state.appUsers.filter(u => u.id !== id) })),
`;
    content = content.replace("login: (user) => set({ currentUser: user }),", actions + "\n      login: (user) => set({ currentUser: user }),");
    
    fs.writeFileSync('store/useStore.ts', content);
}
