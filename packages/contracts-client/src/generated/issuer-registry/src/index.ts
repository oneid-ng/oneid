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

export type Role = { tag: "Issuer"; values: void } | { tag: "Verifier"; values: void };

export interface Entity {
  address: string;
  home_domain: string;
  name: string;
  registered_at: u64;
  role: Role;
  status: EntityStatus;
}

export type DataKey =
  | { tag: "Admin"; values: void }
  | { tag: "Entity"; values: readonly [string] };

export type EntityStatus =
  | { tag: "Active"; values: void }
  | { tag: "Suspended"; values: void }
  | { tag: "Removed"; values: void };

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
   * Read an entity record. Public read.
   */
  get: (
    { addr }: { addr: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Entity>>>;

  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time initialisation with the admin address.
   */
  init: (
    { admin }: { admin: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register a new issuer or verifier. Admin auth required.
   */
  register: (
    { entity }: { entity: Entity },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a set_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Suspend or remove an entity. Admin auth required.
   */
  set_status: (
    { addr, status }: { addr: string; status: EntityStatus },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a transfer_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Governance handover. Admin auth required.
   */
  transfer_admin: (
    { new_admin }: { new_admin: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a is_active_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if the address is an active issuer. Public query.
   */
  is_active_issuer: (
    { addr }: { addr: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a is_active_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if the address is an active verifier. Public query.
   */
  is_active_verifier: (
    { addr }: { addr: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<boolean>>;
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
        "AAAAAAAAACNSZWFkIGFuIGVudGl0eSByZWNvcmQuIFB1YmxpYyByZWFkLgAAAAADZ2V0AAAAAAEAAAAAAAAABGFkZHIAAAATAAAAAQAAA+kAAAfQAAAABkVudGl0eQAAAAAH0AAAABNJc3N1ZXJSZWdpc3RyeUVycm9yAA==",
        "AAAAAAAAAC9PbmUtdGltZSBpbml0aWFsaXNhdGlvbiB3aXRoIHRoZSBhZG1pbiBhZGRyZXNzLgAAAAAEaW5pdAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAAE0lzc3VlclJlZ2lzdHJ5RXJyb3IA",
        "AAAAAgAAAAAAAAAAAAAABFJvbGUAAAACAAAAAAAAAAAAAAAGSXNzdWVyAAAAAAAAAAAAAAAAAAhWZXJpZmllcg==",
        "AAAAAAAAADdSZWdpc3RlciBhIG5ldyBpc3N1ZXIgb3IgdmVyaWZpZXIuIEFkbWluIGF1dGggcmVxdWlyZWQuAAAAAAhyZWdpc3RlcgAAAAEAAAAAAAAABmVudGl0eQAAAAAH0AAAAAZFbnRpdHkAAAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAAE0lzc3VlclJlZ2lzdHJ5RXJyb3IA",
        "AAAAAQAAAAAAAAAAAAAABkVudGl0eQAAAAAABgAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAtob21lX2RvbWFpbgAAAAAQAAAAAAAAAARuYW1lAAAAEAAAAAAAAAANcmVnaXN0ZXJlZF9hdAAAAAAAAAYAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxFbnRpdHlTdGF0dXM=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAQAAAAAAAAAGRW50aXR5AAAAAAABAAAAEw==",
        "AAAAAAAAADFTdXNwZW5kIG9yIHJlbW92ZSBhbiBlbnRpdHkuIEFkbWluIGF1dGggcmVxdWlyZWQuAAAAAAAACnNldF9zdGF0dXMAAAAAAAIAAAAAAAAABGFkZHIAAAATAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRW50aXR5U3RhdHVzAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAATSXNzdWVyUmVnaXN0cnlFcnJvcgA=",
        "AAAAAAAAAClHb3Zlcm5hbmNlIGhhbmRvdmVyLiBBZG1pbiBhdXRoIHJlcXVpcmVkLgAAAAAAAA50cmFuc2Zlcl9hZG1pbgAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAAE0lzc3VlclJlZ2lzdHJ5RXJyb3IA",
        "AAAAAgAAAAAAAAAAAAAADEVudGl0eVN0YXR1cwAAAAMAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAACVN1c3BlbmRlZAAAAAAAAAAAAAAAAAAAB1JlbW92ZWQA",
        "AAAAAAAAADdDaGVjayBpZiB0aGUgYWRkcmVzcyBpcyBhbiBhY3RpdmUgaXNzdWVyLiBQdWJsaWMgcXVlcnkuAAAAABBpc19hY3RpdmVfaXNzdWVyAAAAAQAAAAAAAAAEYWRkcgAAABMAAAABAAAAAQ==",
        "AAAAAAAAADlDaGVjayBpZiB0aGUgYWRkcmVzcyBpcyBhbiBhY3RpdmUgdmVyaWZpZXIuIFB1YmxpYyBxdWVyeS4AAAAAAAASaXNfYWN0aXZlX3ZlcmlmaWVyAAAAAAABAAAAAAAAAARhZGRyAAAAEwAAAAEAAAAB",
        "AAAABAAAAAAAAAAAAAAAE0lzc3VlclJlZ2lzdHJ5RXJyb3IAAAAABgAAABhDYWxsZXIgaXMgbm90IHRoZSBhZG1pbi4AAAAMVW5hdXRob3JpemVkAAAAAQAAABpFbnRpdHkgYWxyZWFkeSByZWdpc3RlcmVkLgAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAAAgAAABFFbnRpdHkgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAAMAAAAdQ29udHJhY3QgYWxyZWFkeSBpbml0aWFsaXNlZC4AAAAAAAASQWxyZWFkeUluaXRpYWxpc2VkAAAAAAAEAAAAEEludmFsaWQgYWRkcmVzcy4AAAAOSW52YWxpZEFkZHJlc3MAAAAAAAUAAAAZQ29udHJhY3Qgbm90IGluaXRpYWxpc2VkLgAAAAAAAA5Ob3RJbml0aWFsaXNlZAAAAAAABg==",
        "AAAABAAAAAAAAAAAAAAAFENvbnNlbnRSZWdpc3RyeUVycm9yAAAACAAAACRSZXF1ZXN0ZXIgaXMgbm90IGFuIGFjdGl2ZSB2ZXJpZmllci4AAAARTm90QWN0aXZlVmVyaWZpZXIAAAAAAADIAAAAH0NvbnNlbnQgcmVjZWlwdCBhbHJlYWR5IGV4aXN0cy4AAAAADkFscmVhZHlHcmFudGVkAAAAAADJAAAAGkNvbnNlbnQgcmVjZWlwdCBub3QgZm91bmQuAAAAAAAITm90Rm91bmQAAADKAAAAGkNvbnNlbnQgYWxyZWFkeSB3aXRoZHJhd24uAAAAAAAQQWxyZWFkeVdpdGhkcmF3bgAAAMsAAAAZQ2FsbGVyIGlzIG5vdCB0aGUgaG9sZGVyLgAAAAAAAAlOb3RIb2xkZXIAAAAAAADMAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAADNAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAzgAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAADP",
        "AAAABAAAAAAAAAAAAAAAFUNyZWRlbnRpYWxTdGF0dXNFcnJvcgAAAAAAAAgAAAAfQ2FsbGVyIGlzIG5vdCBhbiBhY3RpdmUgaXNzdWVyLgAAAAAPTm90QWN0aXZlSXNzdWVyAAAAAGQAAAAeQ3JlZGVudGlhbCBhbHJlYWR5IHJlZ2lzdGVyZWQuAAAAAAARQWxyZWFkeVJlZ2lzdGVyZWQAAAAAAABlAAAAFUNyZWRlbnRpYWwgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAGYAAAAbQ3JlZGVudGlhbCBhbHJlYWR5IHJldm9rZWQuAAAAAA5BbHJlYWR5UmV2b2tlZAAAAAAAZwAAACRPbmx5IHRoZSBvcmlnaW5hbCBpc3N1ZXIgbWF5IHJldm9rZS4AAAARTm90T3JpZ2luYWxJc3N1ZXIAAAAAAABoAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAABpAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAagAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAABr",
        "AAAABAAAAAAAAAAAAAAAFkNvcnJlY3Rpb25UcmFja2VyRXJyb3IAAAAAAAUAAAAWVGlja2V0IGFscmVhZHkgZXhpc3RzLgAAAAAADUFscmVhZHlFeGlzdHMAAAAAAAEsAAAAEVRpY2tldCBub3QgZm91bmQuAAAAAAAACE5vdEZvdW5kAAABLQAAACVDYWxsZXIgaXMgbm90IGEgdGFyZ2V0ZWQgaW5zdGl0dXRpb24uAAAAAAAAFk5vdFRhcmdldGVkSW5zdGl0dXRpb24AAAAAAS4AAAAkVG9vIG1hbnkgaW5zdGl0dXRpb25zIChleGNlZWRzIGNhcCkuAAAAE1Rvb01hbnlJbnN0aXR1dGlvbnMAAAABLwAAABlDYWxsZXIgaXMgbm90IHRoZSBob2xkZXIuAAAAAAAACU5vdEhvbGRlcgAAAAAAATA=",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    get: this.txFromJSON<Result<Entity>>,
    init: this.txFromJSON<Result<void>>,
    register: this.txFromJSON<Result<void>>,
    set_status: this.txFromJSON<Result<void>>,
    transfer_admin: this.txFromJSON<Result<void>>,
    is_active_issuer: this.txFromJSON<boolean>,
    is_active_verifier: this.txFromJSON<boolean>,
  };
}
