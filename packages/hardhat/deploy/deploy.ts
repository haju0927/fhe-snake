import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHESnake = await deploy("FHESnake", {
    from: deployer,
    log: true,
  });

  console.log(`FHESnake contract: `, deployedFHESnake.address);
};
export default func;
func.id = "deploy_FHESnake"; // id required to prevent reexecution
func.tags = ["FHESnake"];
