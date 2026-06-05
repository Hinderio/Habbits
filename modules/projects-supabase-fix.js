(function patchHabitFlowProjectSupabase(window) {
  'use strict';

  const supabaseNs = window.supabase;
  if (!supabaseNs || typeof supabaseNs.createClient !== 'function' || supabaseNs.__habitFlowProjectsPatched) return;

  const originalCreateClient = supabaseNs.createClient.bind(supabaseNs);

  function wrapQueryBuilder(tableName, builder) {
    if (!builder || typeof builder.upsert !== 'function') return builder;
    const originalUpsert = builder.upsert.bind(builder);

    builder.upsert = function patchedUpsert(values, options) {
      if ((tableName === 'projects' || tableName === 'project_phases') && options && options.onConflict === 'user_id,id') {
        return originalUpsert(values, { ...options, onConflict: 'id' });
      }
      return originalUpsert(values, options);
    };

    return builder;
  }

  supabaseNs.createClient = function patchedCreateClient() {
    const client = originalCreateClient.apply(this, arguments);
    if (!client || typeof client.from !== 'function' || client.__habitFlowProjectsPatched) return client;

    const originalFrom = client.from.bind(client);
    client.from = function patchedFrom(tableName) {
      return wrapQueryBuilder(tableName, originalFrom(tableName));
    };
    client.__habitFlowProjectsPatched = true;
    return client;
  };

  supabaseNs.__habitFlowProjectsPatched = true;
})(window);
