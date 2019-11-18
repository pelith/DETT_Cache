module.exports = (sequelize, DataTypes) => {
  var Article = sequelize.define('Article', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    txid: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
    },
    shortLink: {
      type: DataTypes.STRING(32),
      unique: true,
    }
  }, {
    tableName: 'article',
    underscored: true,
  })

  Article.associate = function(models) {
    // associations can be defined here
  }
  return Article
}
