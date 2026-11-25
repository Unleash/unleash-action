module.exports = {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
    },
};
