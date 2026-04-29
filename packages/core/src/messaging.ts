import type { AgentMessage, MessageType } from "@agentnet/types";
import { nanoid } from "nanoid";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage as viemVerifyMessage } from "viem";

export function createMessage<T>(
  type: MessageType,
  from: string,
  to: string,
  payload: T
): AgentMessage<T> {
  return {
    id: nanoid(),
    type,
    from,
    to,
    payload,
    timestamp: Date.now(),
    signature: "",
  };
}

export async function signMessage(
  message: AgentMessage,
  privateKey: string
): Promise<AgentMessage> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const signature = await account.signMessage({
    message: JSON.stringify(message.payload),
  });
  return { ...message, signature };
}

export async function verifyMessage(message: AgentMessage): Promise<boolean> {
  try {
    return await viemVerifyMessage({
      address: message.from as `0x${string}`,
      message: JSON.stringify(message.payload),
      signature: message.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}
