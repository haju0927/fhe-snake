"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHESnakeWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheSnake } = useDeployedContractInfo({
    contractName: "FHESnake",
    chainId: allowedChainId,
  });

  type FHESnakeInfo = Contract<"FHESnake"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [bestResult, setBestResult] = useState<any>();

  const hasContract = Boolean(fheSnake?.address && fheSnake?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(fheSnake!.address, (fheSnake as FHESnakeInfo).abi, providerOrSigner);
  };

  const fetchLongestLength = useCallback(async () => {
    if (!hasContract || !accounts?.[0]) return;
    try {
      const readContract = getContract("read");
      if (!readContract) return;
      const res = await readContract.getLongestLength(accounts[0]);
      setBestResult({ handle: res, contractAddress: fheSnake!.address });
    } catch (err) {
      console.warn("fetchLongestLength failed:", err);
    }
  }, [hasContract, fheSnake?.address, accounts]);

  const {
    decrypt,
    canDecrypt,
    isDecrypting,
    message: decMsg,
    results,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests: bestResult ? [bestResult] : undefined,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const decryptResult = decrypt;

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: fheSnake?.address,
  });

  const canSubmit = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

  const getEncryptionMethodFor = (functionName: "updateLength") => {
    const functionAbi = fheSnake?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi)
      return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` };
    if (!functionAbi.inputs || functionAbi.inputs.length === 0)
      return { method: undefined as string | undefined, error: `No inputs found for ${functionName}` };
    const firstInput = functionAbi.inputs[0]!;
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined };
  };

  const updateLength = useCallback(
    async (length: number) => {
      if (isProcessing || !canSubmit) return;
      setIsProcessing(true);
      setMessage(`Submitting snake length (${length})...`);
      try {
        const { method, error } = getEncryptionMethodFor("updateLength");
        if (!method) return setMessage(error ?? "Encryption method not found");
        setMessage(`Encrypting with ${method}...`);
        const enc = await encryptWith(builder => {
          (builder as any)[method](length);
        });
        if (!enc) return setMessage("Encryption failed");
        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract info or signer not available");
        const params = buildParamsFromAbi(enc, [...fheSnake!.abi] as any[], "updateLength");
        const tx = await writeContract.updateLength(...params, { gasLimit: 300_000 });
        setMessage("Waiting for transaction...");
        await tx.wait();
        setMessage(`Snake length (${length}) submitted!`);
        await fetchLongestLength();
      } catch (e) {
        setMessage(`updateLength() failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canSubmit, encryptWith, getContract, fetchLongestLength, fheSnake?.abi],
  );

  useEffect(() => {
    setMessage("");
  }, [accounts, chainId]);

  return {
    contractAddress: fheSnake?.address,
    canDecrypt,
    decryptResult,
    updateLength,
    fetchLongestLength,
    bestResult,
    results,
    isDecrypting,
    isProcessing,
    canSubmit,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
    message,
  };
};
