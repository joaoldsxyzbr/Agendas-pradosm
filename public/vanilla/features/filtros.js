export function normalizeSearch(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}

export function filterStores(stores,q="",status="todas"){const needle=normalizeSearch(q);return stores.filter(s=>(status==="todas"||(status==="ativas"?s.ativo:!s.ativo))&&(!needle||normalizeSearch(`${s.codigo} ${s.nome}`).includes(needle)));}

export function filterUsers(users,stores,q="",role="todos",status="todos"){const needle=normalizeSearch(q),map=new Map(stores.map(s=>[s.id,`${s.codigo} ${s.nome}`]));return users.filter(u=>(role==="todos"||u.papel===role)&&(status==="todos"||(status==="ativos"?u.ativo:!u.ativo))&&(!needle||normalizeSearch(`${u.nome} ${u.login} ${map.get(u.lojaId)||""}`).includes(needle)));}

export function filterAppointments(items,q=""){const needle=normalizeSearch(q);return needle?items.filter(a=>normalizeSearch(`${a.supplier} ${a.protocol}`).includes(needle)):items;}
