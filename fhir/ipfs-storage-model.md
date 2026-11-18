# IPFS Storage Model

Where the actual clinical content lives, and how it is protected there.

## Role

IPFS = **large clinical artifact storage** (content-addressed, encrypted). The
FHIR resource is canonicalized, hashed, AES-256-GCM encrypted, and pinned. Only
the CID is written to Fabric.

## The bundler

`src/ipfs-bundler.js` wraps the existing `ipfs-service`
(`ehr-backend-v3/ipfs-service`, port 3006, `X-IPFS-Key` auth) rather than
reimplementing Kubo pinning. `setIpfsClient()` is an injection point to reuse
the service's own `src/ipfs.js` in a live deployment.

## Encryption (envelope)

`src/encryption.js` follows Security §17.3: each artifact is encrypted under a
unique DEK wrapped under a patient-scoped KEK. Team D exposes
`setEnvelopeEncryptor(fn)` so the Security team's AES-256-GCM routine is plugged
in once it exists. Until then, a demo path produces real AES-256-GCM ciphertext
(96-bit IV, 128-bit tag) with an ephemeral key.

The important detail (Security §17.4): `plaintextHash` is stored separately from
the CID. The CID commits to the **ciphertext** (changes on every re-encryption
even when content is identical), whereas `plaintextHash` lets a verifier confirm
a re-encrypted artifact still carries the same clinical facts.

## Trust model

IPFS nodes are untrusted (Security §16.1): confidentiality derives entirely
from client-side encryption, never from storage-node access control. Possessing
a CID alone never grants decryption — key material never reaches the storage
tier.

## Lifecycle

```
canonical FHIR  →  encrypt (AES-256-GCM)  →  pin → CID  →  anchor CID on Fabric
```

Failure handling (Group 4 §11): IPFS timeout retries with bounded backoff; on
exhaustion mark `IPFS_UNAVAILABLE` and do **not** anchor a CID that was never
pinned.
