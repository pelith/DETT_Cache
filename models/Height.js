module.exports = (sequelize, DataTypes) => {
  var Height = sequelize.define('Height', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    last_block_height: {
      type: DataTypes.BIGINT(64),
      allowNull: false,
      unique: true,
    }
  }, {
    tableName: 'height',
    underscored: true,
  })

  Height.associate = function(models) {
    // associations can be defined here
  }
  return Height
}
