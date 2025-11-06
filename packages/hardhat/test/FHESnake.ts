import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHESnake, FHESnake__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deploySnakeFixture() {
  const factory = (await ethers.getContractFactory("FHESnake")) as FHESnake__factory;
  const snakeContract = (await factory.deploy()) as FHESnake;
  const snakeContractAddress = await snakeContract.getAddress();
  return { snakeContract, snakeContractAddress };
}

describe("FHESnake Contract Tests", function () {
  let signers: Signers;
  let snakeContract: FHESnake;
  let snakeContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only on FHEVM mock environment.");
      this.skip();
    }

    ({ snakeContract, snakeContractAddress } = await deploySnakeFixture());
  });

  it("should revert when fetching length before playing", async function () {
    await expect(snakeContract.getLongestLength(signers.alice.address)).to.be.revertedWith(
      "FHESnake: player has no record",
    );
  });

  it("should allow first-time snake length submission", async function () {
    const length = 12;

    const encrypted = await fhevm
      .createEncryptedInput(snakeContractAddress, signers.alice.address)
      .add32(length)
      .encrypt();

    await snakeContract.connect(signers.alice).updateLength(encrypted.handles[0], encrypted.inputProof);

    const storedEncrypted = await snakeContract.getLongestLength(signers.alice.address);
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      storedEncrypted,
      snakeContractAddress,
      signers.alice,
    );

    expect(decrypted).to.eq(length);
  });

  it("should update only if new length is longer", async function () {
    const firstLength = 15;
    const betterLength = 25;

    const encryptedFirst = await fhevm
      .createEncryptedInput(snakeContractAddress, signers.alice.address)
      .add32(firstLength)
      .encrypt();

    await snakeContract.connect(signers.alice).updateLength(encryptedFirst.handles[0], encryptedFirst.inputProof);

    const encryptedBetter = await fhevm
      .createEncryptedInput(snakeContractAddress, signers.alice.address)
      .add32(betterLength)
      .encrypt();

    await snakeContract.connect(signers.alice).updateLength(encryptedBetter.handles[0], encryptedBetter.inputProof);

    const storedEncrypted = await snakeContract.getLongestLength(signers.alice.address);
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      storedEncrypted,
      snakeContractAddress,
      signers.alice,
    );

    expect(decrypted).to.eq(betterLength);
  });

  it("should retain old length if new submission is shorter", async function () {
    const originalLength = 18;
    const shorterLength = 10;

    const encryptedOriginal = await fhevm
      .createEncryptedInput(snakeContractAddress, signers.alice.address)
      .add32(originalLength)
      .encrypt();

    await snakeContract.connect(signers.alice).updateLength(encryptedOriginal.handles[0], encryptedOriginal.inputProof);

    const encryptedShort = await fhevm
      .createEncryptedInput(snakeContractAddress, signers.alice.address)
      .add32(shorterLength)
      .encrypt();

    await snakeContract.connect(signers.alice).updateLength(encryptedShort.handles[0], encryptedShort.inputProof);

    const storedEncrypted = await snakeContract.getLongestLength(signers.alice.address);
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      storedEncrypted,
      snakeContractAddress,
      signers.alice,
    );

    expect(decrypted).to.eq(originalLength);
  });

  it("should maintain separate records for multiple players", async function () {
    const aliceLength = 20;
    const bobLength = 30;

    const encAlice = await fhevm
      .createEncryptedInput(snakeContractAddress, signers.alice.address)
      .add32(aliceLength)
      .encrypt();

    const encBob = await fhevm
      .createEncryptedInput(snakeContractAddress, signers.bob.address)
      .add32(bobLength)
      .encrypt();

    await snakeContract.connect(signers.alice).updateLength(encAlice.handles[0], encAlice.inputProof);
    await snakeContract.connect(signers.bob).updateLength(encBob.handles[0], encBob.inputProof);

    const storedAlice = await snakeContract.getLongestLength(signers.alice.address);
    const storedBob = await snakeContract.getLongestLength(signers.bob.address);

    const decAlice = await fhevm.userDecryptEuint(FhevmType.euint32, storedAlice, snakeContractAddress, signers.alice);
    const decBob = await fhevm.userDecryptEuint(FhevmType.euint32, storedBob, snakeContractAddress, signers.bob);

    expect(decAlice).to.eq(aliceLength);
    expect(decBob).to.eq(bobLength);
  });

  it("should correctly report hasPlayed()", async function () {
    const player = signers.alice;

    expect(await snakeContract.hasPlayed(player.address)).to.be.false;

    const encLength = await fhevm.createEncryptedInput(snakeContractAddress, player.address).add32(5).encrypt();

    await snakeContract.connect(player).updateLength(encLength.handles[0], encLength.inputProof);

    expect(await snakeContract.hasPlayed(player.address)).to.be.true;
  });
});
