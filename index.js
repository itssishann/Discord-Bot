require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

// Define a schema and model for user points
const userSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  points: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Create a new Discord client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

// Helper functions to get and update user points
async function getUserPoints(userId) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({ userId });
    await user.save();
  }
  return user.points;
}

async function updateUserPoints(userId, userName, points) {
  const user = await User.findOneAndUpdate(
    { userId },
    { $inc: { points }, $set: { userName } },
    { new: true, upsert: true }
  );
  return user.points;
}

// Command handling
client.on('messageCreate', async message => {
  if (!message.content.startsWith('~') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const adminRoleName = 'mxpManager';
  const memberRoles = message.member.roles.cache;
  const hasAdminRole = memberRoles.some(role => role.name === adminRoleName);

  try {
    if (command === 'addmxp' && hasAdminRole) {
      const target = message.mentions.users.first();
      const points = parseInt(args[1], 10);

      if (target && !isNaN(points)) {
        const newPoints = await updateUserPoints(target.id, target.username, points);
        const embed = new EmbedBuilder()
          .setTitle('MXP Update')
          .setColor('#22c55e')
          .setDescription(`${target.username} now has ${newPoints} ***MXPs***.`)
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('Error')
          .setColor('#FF0000')
          .setDescription('Invalid command usage. Format: ~addmxp @username amount')
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
      }
    } else if (command === 'submxp' && hasAdminRole) {
      const target = message.mentions.users.first();
      const points = parseInt(args[1], 10);

      if (target && !isNaN(points)) {
        const newPoints = await updateUserPoints(target.id, target.username, -points);
        const embed = new EmbedBuilder()
          .setTitle('MXP Update')
          .setColor('#22c55e')
          .setDescription(`${target.username} now has ${newPoints} ***MXPs***.`)
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('Error')
          .setColor('#FF0000')
          .setDescription('Invalid command usage. Format: ~submxp @username amount')
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
      }
    } else if (command === 'getmxp') {
      let targetId = message.author.id; // Default to author's balance
      if (hasAdminRole && args.length > 0) {
        const target = message.mentions.users.first();
        if (target) {
          targetId = target.id;
        } else {
          const embed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#FF0000')
            .setDescription('Invalid command usage. Format: ~getmxp @username')
            .setTimestamp();
          message.channel.send({ embeds: [embed] });
          return;
        }
      }

      const balance = await getUserPoints(targetId);
      const target = await client.users.fetch(targetId);
      const embed = new EmbedBuilder()
        .setTitle('User MXP')
        .setColor('#22c55e')
        .setDescription(`${target.username} has ${balance} ***MXPs***.`)
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    } else if (command === 'getstats' && hasAdminRole) {
      const users = await User.find({});
      if (users.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('No Users Found')
          .setColor('#FF0000')
          .setDescription('No users found in the database.')
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
        return;
      }

      const fields = users.map(user => ({
        name: user.userName || 'Unknown User',
        value: `${user.points} ***MXPs***`,
        inline: true
      }));

      const embed = new EmbedBuilder()
        .setTitle('User MXPs')
        .setColor('#00FF00')
        .addFields(fields)
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    } else if (command === 'coinflip') {
      const randomNumber = Math.random();
      const result = randomNumber < 0.5 ? 'Heads' : 'Tails';
      const embed = new EmbedBuilder()
        .setTitle('Coin Flip Result')
        .setColor('#FFD700')
        .setDescription(`You flipped a coin and got: **${result}**!`)
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    } else if (command === 'helpmxp') {
      const adminCommands = [
        { name: '~addmxp @username amount', value: 'Add MXPs to a user (Admin only)' },
        { name: '~submxp @username amount', value: 'Subtract MXPs from a user (Admin only)' },
        { name: '~getstats', value: 'Get MXPs of all users (Admin only)' }
      ];

      const generalCommands = [
        { name: '~getmxp', value: 'Get your own MXPs' },
        { name: '~getmxp @username', value: 'Get MXPs of a mentioned user (Admin only)' },
        { name: '~coinflip', value: 'Flip a coin' }
      ];

      const embed = new EmbedBuilder()
        .setTitle('Help - MXP Commands')
        .setColor('#FFA500')
        .addFields(
          { name: 'Admin Commands', value: adminCommands.map(cmd => `${cmd.name} - ${cmd.value}`).join('\n') },
          { name: 'General Commands', value: generalCommands.map(cmd => `${cmd.name} - ${cmd.value}`).join('\n') }
        )
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error handling command:', error);
    const embed = new EmbedBuilder()
      .setTitle('Error')
      .setColor('#FF0000')
      .setDescription(`An error occurred while executing the command: \`${error.message}\``)
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }
});
