module.exports = (sequelize, DataTypes) => {
  var CommentEvent = sequelize.define('CommentEvent', {
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
    article_txid: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    event: DataTypes.TEXT(),
  }, {
    tableName: 'comment_event',
    underscored: true,
  })

  CommentEvent.associate = function(models) {
    // associations can be defined here
  }
  return CommentEvent
}
