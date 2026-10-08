'use strict';

/**
 * CoATS Chaincode — Hyperledger Fabric Smart Contract
 *
 * Records tamper-evident audit events for the Complaint Administration &
 * Tracking System. Raw case data is NOT stored on-chain — only SHA-256
 * fingerprints and metadata. This protects complainant PII while still
 * providing an immutable proof-of-record that cannot be altered by any
 * database administrator.
 *
 * Ledger key scheme:
 *   CASE_{caseUid}                     → case creation record
 *   STAGE_CHANGE\0{caseUid}\0{ts}      → stage transition record
 *   PROGRESS\0{caseUid}\0{progressId}  → progress entry record
 *   ACTION\0{caseUid}\0{actionId}      → action completion record
 */

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class CoATSContract extends Contract {

  // ── Initialization ────────────────────────────────────────────────────────

  async InitLedger(ctx) {
    console.info('[CoATS Chaincode] Ledger initialized');
    return JSON.stringify({ status: 'OK', message: 'CoATS ledger ready' });
  }

  // ── Case Created ──────────────────────────────────────────────────────────

  /**
   * Record a new case creation.
   * @param {string} caseUid       - Unique case UID (e.g. "HQ-2026-0001")
   * @param {string} officerId     - ID of the creating officer
   * @param {string} branchId      - ID of the branch
   * @param {string} crimeNumber   - Crime registration number
   * @param {string} timestamp     - ISO timestamp of the operation
   */
  async recordCaseCreated(ctx, caseUid, officerId, branchId, crimeNumber, timestamp) {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${caseUid}|${officerId}|${crimeNumber}|${timestamp}`)
      .digest('hex');

    const txId = ctx.stub.getTxID();

    const record = {
      event: 'CASE_CREATED',
      caseUid,
      officerId,
      branchId,
      crimeNumber,
      fingerprint,
      txId,
      timestamp,
    };

    await ctx.stub.putState(
      `CASE_${caseUid}`,
      Buffer.from(JSON.stringify(record))
    );

    ctx.stub.setEvent('CaseCreated', Buffer.from(JSON.stringify({ caseUid, txId })));

    return JSON.stringify({ txId, fingerprint });
  }

  // ── Stage Changed ─────────────────────────────────────────────────────────

  /**
   * Record a case stage transition.
   * @param {string} caseUid    - Case UID
   * @param {string} officerId  - Officer who made the change
   * @param {string} oldStageId - Previous stage ID
   * @param {string} newStageId - New stage ID
   * @param {string} timestamp  - ISO timestamp
   */
  async recordStageChange(ctx, caseUid, officerId, oldStageId, newStageId, timestamp) {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${caseUid}|${oldStageId}|${newStageId}|${officerId}|${timestamp}`)
      .digest('hex');

    const txId = ctx.stub.getTxID();
    const key = ctx.stub.createCompositeKey('STAGE_CHANGE', [caseUid, timestamp]);

    const record = {
      event: 'STAGE_CHANGED',
      caseUid,
      officerId,
      oldStageId,
      newStageId,
      fingerprint,
      txId,
      timestamp,
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    ctx.stub.setEvent('StageChanged', Buffer.from(JSON.stringify({ caseUid, oldStageId, newStageId, txId })));

    return JSON.stringify({ txId, fingerprint });
  }

  // ── Progress Added ────────────────────────────────────────────────────────

  /**
   * Record a progress entry being added to a case.
   * @param {string} caseUid      - Case UID
   * @param {string} officerId    - Officer who added progress
   * @param {string} progressDate - Date of progress (YYYY-MM-DD)
   * @param {string} progressId   - DB primary key of the progress entry
   * @param {string} timestamp    - ISO timestamp
   */
  async recordProgress(ctx, caseUid, officerId, progressDate, progressId, timestamp) {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${caseUid}|${officerId}|${progressDate}|${progressId}|${timestamp}`)
      .digest('hex');

    const txId = ctx.stub.getTxID();
    const key = ctx.stub.createCompositeKey('PROGRESS', [caseUid, progressId]);

    const record = {
      event: 'PROGRESS_ADDED',
      caseUid,
      officerId,
      progressDate,
      progressId,
      fingerprint,
      txId,
      timestamp,
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    ctx.stub.setEvent('ProgressAdded', Buffer.from(JSON.stringify({ caseUid, progressId, txId })));

    return JSON.stringify({ txId, fingerprint });
  }

  // ── Action Completed ──────────────────────────────────────────────────────

  /**
   * Record a case action being marked as completed.
   * @param {string} caseUid    - Case UID
   * @param {string} officerId  - Officer who completed the action
   * @param {string} actionId   - DB primary key of the action
   * @param {string} timestamp  - ISO timestamp
   */
  async recordActionCompleted(ctx, caseUid, officerId, actionId, timestamp) {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${caseUid}|${officerId}|${actionId}|${timestamp}`)
      .digest('hex');

    const txId = ctx.stub.getTxID();
    const key = ctx.stub.createCompositeKey('ACTION', [caseUid, actionId]);

    const record = {
      event: 'ACTION_COMPLETED',
      caseUid,
      officerId,
      actionId,
      fingerprint,
      txId,
      timestamp,
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    ctx.stub.setEvent('ActionCompleted', Buffer.from(JSON.stringify({ caseUid, actionId, txId })));

    return JSON.stringify({ txId, fingerprint });
  }

  // ── Query Functions ───────────────────────────────────────────────────────

  /**
   * Get the case creation record for a given UID.
   */
  async getCaseRecord(ctx, caseUid) {
    const data = await ctx.stub.getState(`CASE_${caseUid}`);
    if (!data || data.length === 0) {
      throw new Error(`No blockchain record found for case: ${caseUid}`);
    }
    return data.toString();
  }

  /**
   * Get full immutable history of a case creation record.
   * Shows every time the state was written (useful for audit verification).
   */
  async getCaseHistory(ctx, caseUid) {
    const iterator = await ctx.stub.getHistoryForKey(`CASE_${caseUid}`);
    const results = [];

    let res = await iterator.next();
    while (!res.done) {
      const record = {
        txId: res.value.txId,
        timestamp: res.value.timestamp,
        isDelete: res.value.isDelete,
        value: res.value.value ? JSON.parse(res.value.value.toString()) : null,
      };
      results.push(record);
      res = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(results);
  }

  /**
   * Get all stage change records for a case.
   */
  async getStageHistory(ctx, caseUid) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey('STAGE_CHANGE', [caseUid]);
    const results = [];

    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value) {
        results.push(JSON.parse(res.value.value.toString()));
      }
      res = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(results);
  }

  /**
   * Get all progress records for a case.
   */
  async getProgressHistory(ctx, caseUid) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey('PROGRESS', [caseUid]);
    const results = [];

    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value) {
        results.push(JSON.parse(res.value.value.toString()));
      }
      res = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(results);
  }
}

module.exports.contracts = [CoATSContract];
