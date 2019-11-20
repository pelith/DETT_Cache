module.exports = (sequelize, DataTypes) => {
  var CommentEvent = sequelize.define('CommentEvent', {
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
    article_txid: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    event: {
      type: DataTypes.TEXT(),
    }
  }, {
    tableName: 'comment_event',
  })

  CommentEvent.associate = function(models) {
    // associations can be defined here
  }
  return CommentEvent
}
