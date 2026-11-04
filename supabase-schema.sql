-- RpmArea V22 - Jalankan SEKALI di Supabase > SQL Editor > New query.
-- Tabel terpisah menurut workspace_id; akses hanya akun yang tercatat pada rpm_members.
-- UPDATE via RPC dengan expected_version; tanpa DELETE dan tanpa akses anonim.

create table if not exists public.rpm_members (
  workspace_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','editor')),
  primary key (workspace_id, user_id)
);

create table if not exists public.rpm_records (
  workspace_id text not null,
  id text not null check (length(id) between 1 and 500),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  version bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  edited_by uuid references auth.users(id),
  primary key (workspace_id, id)
);

create index if not exists rpm_records_delta_idx
  on public.rpm_records (workspace_id, updated_at, id);

alter table public.rpm_members enable row level security;
alter table public.rpm_records enable row level security;

-- Idempotent when installing on fresh project or rerunning installation.
drop policy if exists "rpm_member_self_read" on public.rpm_members;
create policy "rpm_member_self_read" on public.rpm_members for select
  to authenticated using (user_id = (select auth.uid()));

drop policy if exists "rpm_records_member_read" on public.rpm_records;
create policy "rpm_records_member_read" on public.rpm_records for select
  to authenticated using (
    exists (
      select 1 from public.rpm_members m
      where m.workspace_id = rpm_records.workspace_id
        and m.user_id = (select auth.uid())
    )
  );

-- Tidak beri INSERT/UPDATE/DELETE langsung dari browser. Semua melalui fungsi di bawah.
revoke all on table public.rpm_members from anon, authenticated;
revoke all on table public.rpm_records from anon, authenticated;
grant select on table public.rpm_members to authenticated;
grant select on table public.rpm_records to authenticated;

create or replace function public.rpm_commit(p_workspace_id text, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_change jsonb;
  v_id text;
  v_value jsonb;
  v_expected bigint;
  v_affected integer;
  v_count integer;
begin
  if v_user is null then
    raise exception using errcode='42501', message='Login diperlukan';
  end if;
  if not exists (
    select 1 from public.rpm_members
    where workspace_id=p_workspace_id and user_id=v_user and role='editor'
  ) then
    raise exception using errcode='42501', message='Akun bukan editor workspace ini';
  end if;
  if p_changes is null or pg_catalog.jsonb_typeof(p_changes) <> 'array' then
    raise exception using errcode='22023', message='Format batch harus array JSON';
  end if;
  v_count := pg_catalog.jsonb_array_length(p_changes);
  if v_count > 75 then
    raise exception using errcode='22023', message='Maksimal 75 dokumen per transaksi';
  end if;
  for v_change in select value from pg_catalog.jsonb_array_elements(p_changes) loop
    v_id := v_change->>'id';
    v_value := v_change->'value';
    if v_id is null or pg_catalog.length(v_id) not between 1 and 500
       or v_value is null or pg_catalog.jsonb_typeof(v_value) <> 'object' then
      raise exception using errcode='22023', message='Dokumen tidak valid';
    end if;
    if v_change ? 'expected_version' and v_change->>'expected_version' is not null then
      v_expected := (v_change->>'expected_version')::bigint;
    else
      v_expected := null;
    end if;
    if v_expected is null then
      insert into public.rpm_records (workspace_id,id,value,version,updated_at,edited_by)
      values (p_workspace_id,v_id,v_value,1,pg_catalog.clock_timestamp(),v_user)
      on conflict (workspace_id,id) do nothing;
    else
      update public.rpm_records
        set value=v_value,version=version+1,updated_at=pg_catalog.clock_timestamp(),edited_by=v_user
      where workspace_id=p_workspace_id and id=v_id and version=v_expected;
    end if;
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
      raise exception using errcode='P0001', message='Versi cloud berubah atau dokumen sudah ada. Tidak ada perubahan dalam batch ini.';
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('written',v_count);
end;
$$;

-- SECURITY DEFINER intentionally bypasses RLS *inside the function only*;
-- auth.uid() plus editor check ensure tenants stay isolated.
revoke all on function public.rpm_commit(text,jsonb) from public, anon, authenticated;
grant execute on function public.rpm_commit(text,jsonb) to authenticated;

-- SETELAH MEMBUAT USER DI Authentication > Users:
-- 1. Salin ID / UUID pengguna dari menu Users.
-- 2. Edit ID berikut lalu jalankan SQL ini TERPISAH (hapus tanda --):
-- insert into public.rpm_members (workspace_id, user_id, role)
-- values ('rpm-area-12', '00000000-0000-0000-0000-000000000000'::uuid, 'editor')
-- on conflict (workspace_id, user_id) do update set role=excluded.role;
-- 3. Ulangi untuk setiap pengguna/HP yang memakai akun berbeda.
-- JANGAN menaruh service_role / secret key di file web mana pun.
