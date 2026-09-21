-- Execute este SQL no Supabase SQL Editor depois de criar o usuário do painel.
-- O site público continua podendo ler os produtos.
create policy "products_auth_insert"
on public.products for insert to authenticated
with check (true);

create policy "products_auth_update"
on public.products for update to authenticated
using (true) with check (true);

create policy "products_auth_delete"
on public.products for delete to authenticated
using (true);

grant insert, update, delete on public.products to authenticated;
