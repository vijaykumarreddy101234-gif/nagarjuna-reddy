sed -i "s/profileId: initialProfileId || filteredProfiles\[0\]?.id || '',/profileId: initialProfileId || '',/g" components/ProfileTransactions.tsx
sed -i "s/}, \[isOpen, filteredProfiles, initialProfileId, initialBrand\]);/}, \[isOpen, initialProfileId, initialBrand\]);/g" components/ProfileTransactions.tsx
