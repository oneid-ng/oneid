import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export type DataKey =
  | { tag: "IssuerRegistry"; values: void }
  | { tag: "Consent"; values: readonly [Buffer] };

export type ConsentStatus =
  | { tag: "Active"; values: void }
  | { tag: "Withdrawn"; values: void }
  | { tag: "Expired"; values: void };

export interface ConsentReceipt {
  created_at: u64;
  expires_at: u64;
  holder: string;
  receipt_hash: Buffer;
  requester: string;
  status: ConsentStatus;
  withdrawn_at: Option<u64>;
}

export const IssuerRegistryError = {
  /**
   * Caller is not the admin.
   */
  1: { message: "Unauthorized" },
  /**
   * Entity already registered.
   */
  2: { message: "AlreadyRegistered" },
  /**
   * Entity not found.
   */
  3: { message: "NotFound" },
  /**
   * Contract already initialised.
   */
  4: { message: "AlreadyInitialised" },
  /**
   * Invalid address.
   */
  5: { message: "InvalidAddress" },
  /**
   * Contract not initialised.
   */
  6: { message: "NotInitialised" },
};

export const ConsentRegistryError = {
  /**
   * Requester is not an active verifier.
   */
  200: { message: "NotActiveVerifier" },
  /**
   * Consent receipt already exists.
   */
  201: { message: "AlreadyGranted" },
  /**
   * Consent receipt not found.
   */
  202: { message: "NotFound" },
  /**
   * Consent already withdrawn.
   */
  203: { message: "AlreadyWithdrawn" },
  /**
   * Caller is not the holder.
   */
  204: { message: "NotHolder" },
  /**
   * expiry_ts must be in the future.
   */
  205: { message: "InvalidExpiry" },
  /**
   * Contract already initialised.
   */
  206: { message: "AlreadyInitialised" },
  /**
   * Contract not initialised.
   */
  207: { message: "NotInitialised" },
};

export const CredentialStatusError = {
  /**
   * Caller is not an active issuer.
   */
  100: { message: "NotActiveIssuer" },
  /**
   * Credential already registered.
   */
  101: { message: "AlreadyRegistered" },
  /**
   * Credential not found.
   */
  102: { message: "NotFound" },
  /**
   * Credential already revoked.
   */
  103: { message: "AlreadyRevoked" },
  /**
   * Only the original issuer may revoke.
   */
  104: { message: "NotOriginalIssuer" },
  /**
   * expiry_ts must be in the future.
   */
  105: { message: "InvalidExpiry" },
  /**
   * Contract already initialised.
   */
  106: { message: "AlreadyInitialised" },
  /**
   * Contract not initialised.
   */
  107: { message: "NotInitialised" },
};

export const CorrectionTrackerError = {
  /**
   * Ticket already exists.
   */
  300: { message: "AlreadyExists" },
  /**
   * Ticket not found.
   */
  301: { message: "NotFound" },
  /**
   * Caller is not a targeted institution.
   */
  302: { message: "NotTargetedInstitution" },
  /**
   * Too many institutions (exceeds cap).
   */
  303: { message: "TooManyInstitutions" },
  /**
   * Caller is not the holder.
   */
  304: { message: "NotHolder" },
};

export interface Client {
  /**
   * Construct and simulate a get transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read receipt record.
   */
  get: (
    { receipt_hash }: { receipt_hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<ConsentReceipt>>>;

  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialise with the issuer-registry contract address.
   */
  init: (
    { issuer_registry }: { issuer_registry: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a grant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Record a new consent receipt.
   * Requires authorization from the holder.
   * Fails unless the requester is an ACTIVE verifier in issuer-registry.
   * Never stores purpose text or claims.
   */
  grant: (
    {
      holder,
      receipt_hash,
      requester,
      expires_at,
    }: { holder: string; receipt_hash: Buffer; requester: string; expires_at: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Computed status of the consent receipt with expiry.
   * Returns Expired if past expires_at and not withdrawn.
   * Withdrawn is terminal.
   */
  status: (
    { receipt_hash }: { receipt_hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<ConsentStatus>>>;

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw consent.
   * Requires authorization from the holder.
   *
   * IMPORTANT: Withdrawing consent affects FUTURE sharing only (README §12.3).
   * It does not and cannot delete or erase personal data that the verifier has
   * already received in an earlier disclosure. The UI must disclose this notice
   * to the user prior to consent and withdrawal.
   * Withdrawn is terminal.
   */
  withdraw: (
    { receipt_hash }: { receipt_hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAAAAABRSZWFkIHJlY2VpcHQgcmVjb3JkLgAAAANnZXQAAAAAAQAAAAAAAAAMcmVjZWlwdF9oYXNoAAAD7gAAACAAAAABAAAD6QAAB9AAAAAOQ29uc2VudFJlY2VpcHQAAAAAB9AAAAAUQ29uc2VudFJlZ2lzdHJ5RXJyb3I=",
        "AAAAAAAAADVJbml0aWFsaXNlIHdpdGggdGhlIGlzc3Vlci1yZWdpc3RyeSBjb250cmFjdCBhZGRyZXNzLgAAAAAAAARpbml0AAAAAQAAAAAAAAAPaXNzdWVyX3JlZ2lzdHJ5AAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAABRDb25zZW50UmVnaXN0cnlFcnJvcg==",
        "AAAAAAAAAK9SZWNvcmQgYSBuZXcgY29uc2VudCByZWNlaXB0LgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGhvbGRlci4KRmFpbHMgdW5sZXNzIHRoZSByZXF1ZXN0ZXIgaXMgYW4gQUNUSVZFIHZlcmlmaWVyIGluIGlzc3Vlci1yZWdpc3RyeS4KTmV2ZXIgc3RvcmVzIHB1cnBvc2UgdGV4dCBvciBjbGFpbXMuAAAAAAVncmFudAAAAAAAAAQAAAAAAAAABmhvbGRlcgAAAAAAEwAAAAAAAAAMcmVjZWlwdF9oYXNoAAAD7gAAACAAAAAAAAAACXJlcXVlc3RlcgAAAAAAABMAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAABAAAD6QAAA+0AAAAAAAAH0AAAABRDb25zZW50UmVnaXN0cnlFcnJvcg==",
        "AAAAAAAAAIBDb21wdXRlZCBzdGF0dXMgb2YgdGhlIGNvbnNlbnQgcmVjZWlwdCB3aXRoIGV4cGlyeS4KUmV0dXJucyBFeHBpcmVkIGlmIHBhc3QgZXhwaXJlc19hdCBhbmQgbm90IHdpdGhkcmF3bi4KV2l0aGRyYXduIGlzIHRlcm1pbmFsLgAAAAZzdGF0dXMAAAAAAAEAAAAAAAAADHJlY2VpcHRfaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAADUNvbnNlbnRTdGF0dXMAAAAAAAfQAAAAFENvbnNlbnRSZWdpc3RyeUVycm9y",
        "AAAAAAAAAWFXaXRoZHJhdyBjb25zZW50LgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGhvbGRlci4KCklNUE9SVEFOVDogV2l0aGRyYXdpbmcgY29uc2VudCBhZmZlY3RzIEZVVFVSRSBzaGFyaW5nIG9ubHkgKFJFQURNRSDCpzEyLjMpLgpJdCBkb2VzIG5vdCBhbmQgY2Fubm90IGRlbGV0ZSBvciBlcmFzZSBwZXJzb25hbCBkYXRhIHRoYXQgdGhlIHZlcmlmaWVyIGhhcwphbHJlYWR5IHJlY2VpdmVkIGluIGFuIGVhcmxpZXIgZGlzY2xvc3VyZS4gVGhlIFVJIG11c3QgZGlzY2xvc2UgdGhpcyBub3RpY2UKdG8gdGhlIHVzZXIgcHJpb3IgdG8gY29uc2VudCBhbmQgd2l0aGRyYXdhbC4KV2l0aGRyYXduIGlzIHRlcm1pbmFsLgAAAAAAAAh3aXRoZHJhdwAAAAEAAAAAAAAADHJlY2VpcHRfaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAUQ29uc2VudFJlZ2lzdHJ5RXJyb3I=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAAAAAAADklzc3VlclJlZ2lzdHJ5AAAAAAABAAAAAAAAAAdDb25zZW50AAAAAAEAAAPuAAAAIA==",
        "AAAAAgAAAAAAAAAAAAAADUNvbnNlbnRTdGF0dXMAAAAAAAADAAAAAAAAAAAAAAAGQWN0aXZlAAAAAAAAAAAAAAAAAAlXaXRoZHJhd24AAAAAAAAAAAAAAAAAAAdFeHBpcmVkAA==",
        "AAAAAQAAAAAAAAAAAAAADkNvbnNlbnRSZWNlaXB0AAAAAAAHAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAAAAAAZob2xkZXIAAAAAABMAAAAAAAAADHJlY2VpcHRfaGFzaAAAA+4AAAAgAAAAAAAAAAlyZXF1ZXN0ZXIAAAAAAAATAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAANQ29uc2VudFN0YXR1cwAAAAAAAAAAAAAMd2l0aGRyYXduX2F0AAAD6AAAAAY=",
        "AAAABAAAAAAAAAAAAAAAE0lzc3VlclJlZ2lzdHJ5RXJyb3IAAAAABgAAABhDYWxsZXIgaXMgbm90IHRoZSBhZG1pbi4AAAAMVW5hdXRob3JpemVkAAAAAQAAABpFbnRpdHkgYWxyZWFkeSByZWdpc3RlcmVkLgAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAAAgAAABFFbnRpdHkgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAAMAAAAdQ29udHJhY3QgYWxyZWFkeSBpbml0aWFsaXNlZC4AAAAAAAASQWxyZWFkeUluaXRpYWxpc2VkAAAAAAAEAAAAEEludmFsaWQgYWRkcmVzcy4AAAAOSW52YWxpZEFkZHJlc3MAAAAAAAUAAAAZQ29udHJhY3Qgbm90IGluaXRpYWxpc2VkLgAAAAAAAA5Ob3RJbml0aWFsaXNlZAAAAAAABg==",
        "AAAABAAAAAAAAAAAAAAAFENvbnNlbnRSZWdpc3RyeUVycm9yAAAACAAAACRSZXF1ZXN0ZXIgaXMgbm90IGFuIGFjdGl2ZSB2ZXJpZmllci4AAAARTm90QWN0aXZlVmVyaWZpZXIAAAAAAADIAAAAH0NvbnNlbnQgcmVjZWlwdCBhbHJlYWR5IGV4aXN0cy4AAAAADkFscmVhZHlHcmFudGVkAAAAAADJAAAAGkNvbnNlbnQgcmVjZWlwdCBub3QgZm91bmQuAAAAAAAITm90Rm91bmQAAADKAAAAGkNvbnNlbnQgYWxyZWFkeSB3aXRoZHJhd24uAAAAAAAQQWxyZWFkeVdpdGhkcmF3bgAAAMsAAAAZQ2FsbGVyIGlzIG5vdCB0aGUgaG9sZGVyLgAAAAAAAAlOb3RIb2xkZXIAAAAAAADMAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAADNAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAzgAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAADP",
        "AAAABAAAAAAAAAAAAAAAFUNyZWRlbnRpYWxTdGF0dXNFcnJvcgAAAAAAAAgAAAAfQ2FsbGVyIGlzIG5vdCBhbiBhY3RpdmUgaXNzdWVyLgAAAAAPTm90QWN0aXZlSXNzdWVyAAAAAGQAAAAeQ3JlZGVudGlhbCBhbHJlYWR5IHJlZ2lzdGVyZWQuAAAAAAARQWxyZWFkeVJlZ2lzdGVyZWQAAAAAAABlAAAAFUNyZWRlbnRpYWwgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAGYAAAAbQ3JlZGVudGlhbCBhbHJlYWR5IHJldm9rZWQuAAAAAA5BbHJlYWR5UmV2b2tlZAAAAAAAZwAAACRPbmx5IHRoZSBvcmlnaW5hbCBpc3N1ZXIgbWF5IHJldm9rZS4AAAARTm90T3JpZ2luYWxJc3N1ZXIAAAAAAABoAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAABpAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAagAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAABr",
        "AAAABAAAAAAAAAAAAAAAFkNvcnJlY3Rpb25UcmFja2VyRXJyb3IAAAAAAAUAAAAWVGlja2V0IGFscmVhZHkgZXhpc3RzLgAAAAAADUFscmVhZHlFeGlzdHMAAAAAAAEsAAAAEVRpY2tldCBub3QgZm91bmQuAAAAAAAACE5vdEZvdW5kAAABLQAAACVDYWxsZXIgaXMgbm90IGEgdGFyZ2V0ZWQgaW5zdGl0dXRpb24uAAAAAAAAFk5vdFRhcmdldGVkSW5zdGl0dXRpb24AAAAAAS4AAAAkVG9vIG1hbnkgaW5zdGl0dXRpb25zIChleGNlZWRzIGNhcCkuAAAAE1Rvb01hbnlJbnN0aXR1dGlvbnMAAAABLwAAABlDYWxsZXIgaXMgbm90IHRoZSBob2xkZXIuAAAAAAAACU5vdEhvbGRlcgAAAAAAATA=",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    get: this.txFromJSON<Result<ConsentReceipt>>,
    init: this.txFromJSON<Result<void>>,
    grant: this.txFromJSON<Result<void>>,
    status: this.txFromJSON<Result<ConsentStatus>>,
    withdraw: this.txFromJSON<Result<void>>,
  };
}
