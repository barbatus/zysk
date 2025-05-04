cube(`Users`, {
  sql_table: `public.users`,

  dimensions: {
    id: {
      type: `string`,
      sql: `id`,
      primaryKey: true,
    },

    email: {
      type: `string`,
      sql: `email`,
    }
  },

  joins: {
    PortfolioCube: {
      relationship: `many_to_one`,
      sql: `${CUBE.id} = ${PortfolioCube.userId}`,
    },
  },
});
