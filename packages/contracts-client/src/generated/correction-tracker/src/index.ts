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

export interface Ticket {
  created_at: u64;
  holder: string;
  outcomes: Array<InstitutionOutcome>;
  ticket_hash: Buffer;
}

export type DataKey = { tag: "Ticket"; values: readonly [Buffer] };

export type TicketStatus =
  | { tag: "Submitted"; values: void }
  | { tag: "UnderReview"; values: void }
  | { tag: "Applied"; values: void }
  | { tag: "Rejected"; values: void }
  | { tag: "Failed"; values: void }
  | { tag: "PartiallyApplied"; values: void };

export interface InstitutionOutcome {
  institution: string;
  reason_code: Option<u32>;
  status: TicketStatus;
  updated_at: u64;
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
   * Read the ticket trail. Public read.
   */
  get: (
    { ticket_hash }: { ticket_hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Ticket>>>;

  /**
   * Construct and simulate a open transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Open a new correction ticket targeting specific institutions.
   * Holder authorization required.
   * Cap on institutions is enforced (README §12.4, §12.5).
   */
  open: (
    {
      holder,
      ticket_hash,
      institutions,
    }: { holder: string; ticket_hash: Buffer; institutions: Array<string> },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a update transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update ticket status for a specific institution.
   * Callable ONLY by that institution and updates ONLY its own outcome entry.
   * Reason is an optional numeric code, never free text.
   */
  update: (
    {
      institution,
      ticket_hash,
      status,
      reason_code,
    }: {
      institution: string;
      ticket_hash: Buffer;
      status: TicketStatus;
      reason_code: Option<u32>;
    },
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
        "AAAAAAAAACNSZWFkIHRoZSB0aWNrZXQgdHJhaWwuIFB1YmxpYyByZWFkLgAAAAADZ2V0AAAAAAEAAAAAAAAAC3RpY2tldF9oYXNoAAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAABlRpY2tldAAAAAAH0AAAABZDb3JyZWN0aW9uVHJhY2tlckVycm9yAAA=",
        "AAAAAAAAAJVPcGVuIGEgbmV3IGNvcnJlY3Rpb24gdGlja2V0IHRhcmdldGluZyBzcGVjaWZpYyBpbnN0aXR1dGlvbnMuCkhvbGRlciBhdXRob3JpemF0aW9uIHJlcXVpcmVkLgpDYXAgb24gaW5zdGl0dXRpb25zIGlzIGVuZm9yY2VkIChSRUFETUUgwqcxMi40LCDCpzEyLjUpLgAAAAAAAARvcGVuAAAAAwAAAAAAAAAGaG9sZGVyAAAAAAATAAAAAAAAAAt0aWNrZXRfaGFzaAAAAAPuAAAAIAAAAAAAAAAMaW5zdGl0dXRpb25zAAAD6gAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAABZDb3JyZWN0aW9uVHJhY2tlckVycm9yAAA=",
        "AAAAAAAAAK9VcGRhdGUgdGlja2V0IHN0YXR1cyBmb3IgYSBzcGVjaWZpYyBpbnN0aXR1dGlvbi4KQ2FsbGFibGUgT05MWSBieSB0aGF0IGluc3RpdHV0aW9uIGFuZCB1cGRhdGVzIE9OTFkgaXRzIG93biBvdXRjb21lIGVudHJ5LgpSZWFzb24gaXMgYW4gb3B0aW9uYWwgbnVtZXJpYyBjb2RlLCBuZXZlciBmcmVlIHRleHQuAAAAAAZ1cGRhdGUAAAAAAAQAAAAAAAAAC2luc3RpdHV0aW9uAAAAABMAAAAAAAAAC3RpY2tldF9oYXNoAAAAA+4AAAAgAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMVGlja2V0U3RhdHVzAAAAAAAAAAtyZWFzb25fY29kZQAAAAPoAAAABAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAAFkNvcnJlY3Rpb25UcmFja2VyRXJyb3IAAA==",
        "AAAAAQAAAAAAAAAAAAAABlRpY2tldAAAAAAABAAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAAAAAAAGaG9sZGVyAAAAAAATAAAAAAAAAAhvdXRjb21lcwAAA+oAAAfQAAAAEkluc3RpdHV0aW9uT3V0Y29tZQAAAAAAAAAAAAt0aWNrZXRfaGFzaAAAAAPuAAAAIA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAQAAAAEAAAAAAAAABlRpY2tldAAAAAAAAQAAA+4AAAAg",
        "AAAAAgAAAAAAAAAAAAAADFRpY2tldFN0YXR1cwAAAAYAAAAAAAAAAAAAAAlTdWJtaXR0ZWQAAAAAAAAAAAAAAAAAAAtVbmRlclJldmlldwAAAAAAAAAAAAAAAAdBcHBsaWVkAAAAAAAAAAAAAAAACFJlamVjdGVkAAAAAAAAAAAAAAAGRmFpbGVkAAAAAAAAAAAAAAAAABBQYXJ0aWFsbHlBcHBsaWVk",
        "AAAAAQAAAAAAAAAAAAAAEkluc3RpdHV0aW9uT3V0Y29tZQAAAAAABAAAAAAAAAALaW5zdGl0dXRpb24AAAAAEwAAAAAAAAALcmVhc29uX2NvZGUAAAAD6AAAAAQAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxUaWNrZXRTdGF0dXMAAAAAAAAACnVwZGF0ZWRfYXQAAAAAAAY=",
        "AAAABAAAAAAAAAAAAAAAE0lzc3VlclJlZ2lzdHJ5RXJyb3IAAAAABgAAABhDYWxsZXIgaXMgbm90IHRoZSBhZG1pbi4AAAAMVW5hdXRob3JpemVkAAAAAQAAABpFbnRpdHkgYWxyZWFkeSByZWdpc3RlcmVkLgAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAAAgAAABFFbnRpdHkgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAAMAAAAdQ29udHJhY3QgYWxyZWFkeSBpbml0aWFsaXNlZC4AAAAAAAASQWxyZWFkeUluaXRpYWxpc2VkAAAAAAAEAAAAEEludmFsaWQgYWRkcmVzcy4AAAAOSW52YWxpZEFkZHJlc3MAAAAAAAUAAAAZQ29udHJhY3Qgbm90IGluaXRpYWxpc2VkLgAAAAAAAA5Ob3RJbml0aWFsaXNlZAAAAAAABg==",
        "AAAABAAAAAAAAAAAAAAAFENvbnNlbnRSZWdpc3RyeUVycm9yAAAACAAAACRSZXF1ZXN0ZXIgaXMgbm90IGFuIGFjdGl2ZSB2ZXJpZmllci4AAAARTm90QWN0aXZlVmVyaWZpZXIAAAAAAADIAAAAH0NvbnNlbnQgcmVjZWlwdCBhbHJlYWR5IGV4aXN0cy4AAAAADkFscmVhZHlHcmFudGVkAAAAAADJAAAAGkNvbnNlbnQgcmVjZWlwdCBub3QgZm91bmQuAAAAAAAITm90Rm91bmQAAADKAAAAGkNvbnNlbnQgYWxyZWFkeSB3aXRoZHJhd24uAAAAAAAQQWxyZWFkeVdpdGhkcmF3bgAAAMsAAAAZQ2FsbGVyIGlzIG5vdCB0aGUgaG9sZGVyLgAAAAAAAAlOb3RIb2xkZXIAAAAAAADMAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAADNAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAzgAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAADP",
        "AAAABAAAAAAAAAAAAAAAFUNyZWRlbnRpYWxTdGF0dXNFcnJvcgAAAAAAAAgAAAAfQ2FsbGVyIGlzIG5vdCBhbiBhY3RpdmUgaXNzdWVyLgAAAAAPTm90QWN0aXZlSXNzdWVyAAAAAGQAAAAeQ3JlZGVudGlhbCBhbHJlYWR5IHJlZ2lzdGVyZWQuAAAAAAARQWxyZWFkeVJlZ2lzdGVyZWQAAAAAAABlAAAAFUNyZWRlbnRpYWwgbm90IGZvdW5kLgAAAAAAAAhOb3RGb3VuZAAAAGYAAAAbQ3JlZGVudGlhbCBhbHJlYWR5IHJldm9rZWQuAAAAAA5BbHJlYWR5UmV2b2tlZAAAAAAAZwAAACRPbmx5IHRoZSBvcmlnaW5hbCBpc3N1ZXIgbWF5IHJldm9rZS4AAAARTm90T3JpZ2luYWxJc3N1ZXIAAAAAAABoAAAAIGV4cGlyeV90cyBtdXN0IGJlIGluIHRoZSBmdXR1cmUuAAAADUludmFsaWRFeHBpcnkAAAAAAABpAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGlzZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXNlZAAAAAAAagAAABlDb250cmFjdCBub3QgaW5pdGlhbGlzZWQuAAAAAAAADk5vdEluaXRpYWxpc2VkAAAAAABr",
        "AAAABAAAAAAAAAAAAAAAFkNvcnJlY3Rpb25UcmFja2VyRXJyb3IAAAAAAAYAAAAWVGlja2V0IGFscmVhZHkgZXhpc3RzLgAAAAAADUFscmVhZHlFeGlzdHMAAAAAAAEsAAAAEVRpY2tldCBub3QgZm91bmQuAAAAAAAACE5vdEZvdW5kAAABLQAAACVDYWxsZXIgaXMgbm90IGEgdGFyZ2V0ZWQgaW5zdGl0dXRpb24uAAAAAAAAFk5vdFRhcmdldGVkSW5zdGl0dXRpb24AAAAAAS4AAAAkVG9vIG1hbnkgaW5zdGl0dXRpb25zIChleGNlZWRzIGNhcCkuAAAAE1Rvb01hbnlJbnN0aXR1dGlvbnMAAAABLwAAABlDYWxsZXIgaXMgbm90IHRoZSBob2xkZXIuAAAAAAAACU5vdEhvbGRlcgAAAAAAATAAAAAYRW1wdHkgaW5zdGl0dXRpb25zIGxpc3QuAAAAEUVtcHR5SW5zdGl0dXRpb25zAAAAAAABMQ==",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    get: this.txFromJSON<Result<Ticket>>,
    open: this.txFromJSON<Result<void>>,
    update: this.txFromJSON<Result<void>>,
  };
}
