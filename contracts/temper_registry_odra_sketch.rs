//! Temper Result Registry — Odra contract (source)
//!
//! Purpose: store dual-run test outcomes on Casper Testnet.
//! Fields: scenario_id, agent_id, passed, failure_kind, trace_hash, result_tx_hash
//!
//! Build/deploy requires Rust + Odra toolchain (not required for the local dual-run demo).
//! This file is the on-chain schema target for the live registry path.

// Pseudocode / Odra-shaped reference (compile with Odra when toolchain is available):
//
// use odra::prelude::*;
//
// #[odra::module]
// pub struct TemperRegistry {
//     runs: Mapping<u64, RunRecord>,
//     next_id: Var<u64>,
// }
//
// #[odra::odra_type]
// pub struct RunRecord {
//     scenario_id: String,
//     agent_id: String,
//     passed: bool,
//     failure_kind: String,
//     trace_hash: String,
//     result_tx_hash: String,
// }
//
// #[odra::module]
// impl TemperRegistry {
//     pub fn record_run(
//         &mut self,
//         scenario_id: String,
//         agent_id: String,
//         passed: bool,
//         failure_kind: String,
//         trace_hash: String,
//         result_tx_hash: String,
//     ) -> u64 { ... }
//
//     pub fn get_run(&self, id: u64) -> Option<RunRecord> { ... }
// }

pub const CONTRACT_NAME: &str = "temper_registry";
pub const ENTRY_RECORD_RUN: &str = "record_run";
pub const ENTRY_GET_RUN: &str = "get_run";
