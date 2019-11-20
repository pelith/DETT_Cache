module.exports = (sequelize, DataTypes) => {
  var Article = sequelize.define('Article', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    block_number: {
      type: DataTypes.BIGINT(64),
      allowNull: false,
    },
    txid: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
    },
    short_link: {
      type: DataTypes.STRING(32),
      unique: true,
    }
  }, {
    tableName: 'article',
  })

  Article.associate = function(models) {
    // associations can be defined here
  }
  return Article
}
