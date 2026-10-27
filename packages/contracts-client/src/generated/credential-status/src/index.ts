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
  | { tag: "Credential"; values: readonly [Buffer] };

export type CredStatus =
  | { tag: "Active"; values: void }
  | { tag: "Revoked"; values: void }
  | { tag: "Expired"; values: void };

export interface CredentialRecord {
  credential_hash: Buffer;
  expires_at: u64;
  holder: string;
  issued_at: u64;
  issuer: string;
  revoked_at: Option<u64>;
  status: CredStatus;
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
  /**
   * Empty institutions list.
   */
  305: { message: "EmptyInstitutions" },
};

export interface Client {
  /**
   * Construct and simulate a get transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read the full credential record.
   */
  get: (
    { hash }: { hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<CredentialRecord>>>;

  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialise with the issuer-registry contract address.
   */
  init: (
    { issuer_registry }: { issuer_registry: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a revoke transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revoke a credential. Reason is a numeric code, never free text.
   * Only callable by the original issuing issuer.
   */
  revoke: (
    { hash, reason_code }: { hash: Buffer; reason_code: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Computed status of the credential.
   * Returns Expired when ledger time passes expires_at.
   * Revoked is terminal: once revoked, always revoked.
   */
  status: (
    { hash }: { hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<CredStatus>>>;

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Anchor a new credential. Requires auth from an active issuer.
   */
  register: (
    {
      issuer,
      hash,
      holder,
      expires_at,
    }: { issuer: string; hash: Buffer; holder: string; expires_at: u64 },
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
        "AAAAAAAAACBSZWFkIHRoZSBmdWxsIGNyZWRlbnRpYWwgcmVjb3JkLgAAAANnZXQAAAAAAQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAAEENyZWRlbnRpYWxSZWNvcmQAAAfQAAAAFUNyZWRlbnRpYWxTdGF0dXNFcnJvcgAAAA==",
        "AAAAAAAAADVJbml0aWFsaXNlIHdpdGggdGhlIGlzc3Vlci1yZWdpc3RyeSBjb250cmFjdCBhZGRyZXNzLgAAAAAAAARpbml0AAAAAQAAAAAAAAAPaXNzdWVyX3JlZ2lzdHJ5AAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAABVDcmVkZW50aWFsU3RhdHVzRXJyb3IAAAA=",
        "AAAAAAAAAG1SZXZva2UgYSBjcmVkZW50aWFsLiBSZWFzb24gaXMgYSBudW1lcmljIGNvZGUsIG5ldmVyIGZyZWUgdGV4dC4KT25seSBjYWxsYWJsZSBieSB0aGUgb3JpZ2luYWwgaXNzdWluZyBpc3N1ZXIuAAAAAAAABnJldm9rZQAAAAAAAgAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAAAAAAtyZWFzb25fY29kZQAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAVQ3JlZGVudGlhbFN0YXR1c0Vycm9yAAAA",
        "AAAAAAAAAIlDb21wdXRlZCBzdGF0dXMgb2YgdGhlIGNyZWRlbnRpYWwuClJldHVybnMgRXhwaXJlZCB3aGVuIGxlZGdlciB0aW1lIHBhc3NlcyBleHBpcmVzX2F0LgpSZXZva2VkIGlzIHRlcm1pbmFsOiBvbmNlIHJldm9rZWQsIGFsd2F5cyByZXZva2VkLgAAAAAAAAZzdGF0dXMAAAAAAAEAAAAAAAAABGhhc2gAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAApDcmVkU3RhdHVzAAAAAAfQAAAAFUNyZWRlbnRpYWxTdGF0dXNFcnJvcgAAAA==",
        "AAAAAAAAAD1BbmNob3IgYSBuZXcgY3JlZGVudGlhbC4gUmVxdWlyZXMgYXV0aCBmcm9tIGFuIGFjdGl2ZSBpc3N1ZXIuAAAAAAAACHJlZ2lzdGVyAAAABAAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAARoYXNoAAAD7gAAACAAAAAAAAAABmhvbGRlcgAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAEAAAPpAAAD7QAAAAAAAAfQAAAAFUNyZWRlbnRpYWxTdGF0dXNFcnJvcgAAAA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAAAAAAADklzc3VlclJlZ2lzdHJ5AAAAAAABAAAAAAAAAApDcmVkZW50aWFsAAAAAAABAAAD7gAAACA=",
        "AAAAAgAAAAAAAAAAAAAACkNyZWRTdGF0dXMAAAAAAAMAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAAB1Jldm9rZWQAAAAAAAAAAAAAAAAHRXhwaXJlZAA=",
        "AAAAAQAAAAAAAAAAAAAAEENyZWRlbnRpYWxSZWNvcmQAAAAHAAAAAAAAAA9jcmVkZW50aWFsX2hhc2gAAAAD7gAAACAAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAAAAAAABmhvbGRlcgAAAAAAEwAAAAAAAAAJaXNzdWVkX2F0AAAAAAAABgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAApyZXZva2VkX2F0AAAAAAPoAAAABgAAAAAAAAAGc3RhdHVzAAAAAAfQAAAACkNyZWRTdGF0dXMAAA==",
        "AAAABAAAAAAAAAAAAAAAE0lzc3VlclJlZ2lzdHJ5RXJyb3IAAAAABgAAABhDYWxsZXIgaXMgbm90IHRoZSBhZG1pbi4AAAAMVW5hdXRob3JpemVkAAAAAQAAABpFbnRpdHkgYWxyZWFkeSByZWdpc3RlcmVkLgAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAAAgAAABFFbnRpdHkgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAAMAAAAdQ29udHJhY3QgYWxyZWFkeSBpbml0aWFsaXNlZC4AAAAAAAASQWxyZWFkeUluaXRpYWxpc2VkAAAAAAAEAAAAEEludmFsaWQgYWRkcmVzcy4AAAAOSW52YWxpZEFkZHJlc3MAAAAAAAUAAAAZQ29udHJhY3Qgbm90IGluaXRpYWxpc2VkLgAAAAAAAA5Ob3RJbml0aWFsaXNlZAAAAAAABg==",
        "AAAABAAAAAAAAAAAAAAAFENvbnNlbnRSZWdpc3RyeUVycm9yAAAACAAAACRSZXF1ZXN0ZXIgaXMgbm90IGFuIGFjdGl2ZSB2ZXJpZmllci4AAAARTm90QWN0aXZlVmVyaWZpZXIAAAAAAADIAAAAH0NvbnNlbnQgcmVjZWlwdCBhbHJlYWR5IGV4aXN0cy4AAAAADkFscmVhZHlHcmFudGVkAAAAAADJAAAAGkNvbnNlbnQgcmVjZWlwdCBub3QgZm91bmQuAAAAAAAITm90Rm91bmQAAADKAAAAGkNvbnNlbnQgYWxyZWFkeSB3aXRoZHJhd24uAAAAAAAQQWxyZWFkeVdpdGhkcmF3bgAAAMsAAAAZQ2FsbGVyIGlzIG5vdCB0aGUgaG9sZGVyLgAAAAAAAAlOb3RIb2xkZXIAAAAAAADMAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAADNAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAzgAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAADP",
        "AAAABAAAAAAAAAAAAAAAFUNyZWRlbnRpYWxTdGF0dXNFcnJvcgAAAAAAAAgAAAAfQ2FsbGVyIGlzIG5vdCBhbiBhY3RpdmUgaXNzdWVyLgAAAAAPTm90QWN0aXZlSXNzdWVyAAAAAGQAAAAeQ3JlZGVudGlhbCBhbHJlYWR5IHJlZ2lzdGVyZWQuAAAAAAARQWxyZWFkeVJlZ2lzdGVyZWQAAAAAAABlAAAAFUNyZWRlbnRpYWwgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAGYAAAAbQ3JlZGVudGlhbCBhbHJlYWR5IHJldm9rZWQuAAAAAA5BbHJlYWR5UmV2b2tlZAAAAAAAZwAAACRPbmx5IHRoZSBvcmlnaW5hbCBpc3N1ZXIgbWF5IHJldm9rZS4AAAARTm90T3JpZ2luYWxJc3N1ZXIAAAAAAABoAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAABpAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAagAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAABr",
        "AAAABAAAAAAAAAAAAAAAFkNvcnJlY3Rpb25UcmFja2VyRXJyb3IAAAAAAAYAAAAWVGlja2V0IGFscmVhZHkgZXhpc3RzLgAAAAAADUFscmVhZHlFeGlzdHMAAAAAAAEsAAAAEVRpY2tldCBub3QgZm91bmQuAAAAAAAACE5vdEZvdW5kAAABLQAAACVDYWxsZXIgaXMgbm90IGEgdGFyZ2V0ZWQgaW5zdGl0dXRpb24uAAAAAAAAFk5vdFRhcmdldGVkSW5zdGl0dXRpb24AAAAAAS4AAAAkVG9vIG1hbnkgaW5zdGl0dXRpb25zIChleGNlZWRzIGNhcCkuAAAAE1Rvb01hbnlJbnN0aXR1dGlvbnMAAAABLwAAABlDYWxsZXIgaXMgbm90IHRoZSBob2xkZXIuAAAAAAAACU5vdEhvbGRlcgAAAAAAATAAAAAYRW1wdHkgaW5zdGl0dXRpb25zIGxpc3QuAAAAEUVtcHR5SW5zdGl0dXRpb25zAAAAAAABMQ==",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    get: this.txFromJSON<Result<CredentialRecord>>,
    init: this.txFromJSON<Result<void>>,
    revoke: this.txFromJSON<Result<void>>,
    status: this.txFromJSON<Result<CredStatus>>,
    register: this.txFromJSON<Result<void>>,
  };
}
