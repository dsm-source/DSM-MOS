-- Migration: 20260816000007_m5_add_rework_enum.sql
-- Milestone: M5 (Production Execution) — Task M5.1
-- PRD ref: §7 rule #3 (rework hanya lewat RPC formal "Trigger Rework"; ditegakkan
--          penuh oleh RPC di M6 — migration ini hanya menyiapkan nilai enum)
-- Tanggal: 2026-08-16
--
-- Tambah value 'rework' ke enum production_step_status.
--
-- Dipisah dari CREATE OR REPLACE FUNCTION yang memakainya (lihat
-- 20260816000008_m5_validate_transition_rework.sql) karena Postgres tidak
-- mengizinkan sebuah value enum yang baru ditambahkan lewat ALTER TYPE ... ADD
-- VALUE dipakai (referenced) dalam transaksi yang sama dengan statement ADD
-- VALUE tersebut.
--
-- Idempotent lewat IF NOT EXISTS — aman di-replay di local stack.

ALTER TYPE public.production_step_status ADD VALUE IF NOT EXISTS 'rework';
