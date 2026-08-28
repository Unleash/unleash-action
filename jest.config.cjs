module.exports = {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.(ts|tsx)?$': [
            'ts-jest',
            { useESM: true, tsconfig: { module: 'ESNext', moduleResolution: 'bundler' } },
        ],
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
};
