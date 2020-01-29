const NapToken = artifacts.require('NapToken');
const TestRelay = artifacts.require('TestRelay');

module.exports = async function(deployer, network) {
    if (network !== 'test') {
        return;
    }

    await deployer.deploy(TestRelay, 1, 1);
    await deployer.deploy(NapToken, TestRelay.address);

};
