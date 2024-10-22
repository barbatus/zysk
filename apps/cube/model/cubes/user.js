cube(`User`, {
  sql_table: `public.user`,

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
    UserTickers: {
      relationship: `many_to_one`,
      sql: `${CUBE}.id = ${UserTickers.userId}`,
    },
  },
});
