/**
 * @octokit/graphql モック (CommonJS)
 */

// モック graphql 関数
const graphql = jest.fn();

// defaults メソッドを追加
graphql.defaults = jest.fn(() => graphql);

module.exports = { graphql };
