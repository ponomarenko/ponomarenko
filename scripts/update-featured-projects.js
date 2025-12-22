const fs = require('fs');
const path = require('path');

const GITHUB_USERNAME = 'ponomarenko';
const README_PATH = path.join(__dirname, '..', 'README.md');

async function fetchRepositories() {
  const response = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`
        })
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return await response.json();
}

function calculateScore(repo) {
  const stars = repo.stargazers_count || 0;
  const forks = repo.forks_count || 0;
  const watchers = repo.watchers_count || 0;
  const hasDescription = repo.description ? 1 : 0;
  const isRecent = (Date.now() - new Date(repo.updated_at)) < (180 * 24 * 60 * 60 * 1000) ? 1 : 0;

  return (stars * 10) + (forks * 5) + (watchers * 2) + (hasDescription * 5) + (isRecent * 3);
}

function getTopRepositories(repos, count = 5) {
  return repos
    .filter(repo => !repo.fork && !repo.archived)
    .filter(repo => repo.name !== GITHUB_USERNAME)
    .map(repo => ({
      name: repo.name,
      description: repo.description || 'No description provided',
      url: repo.html_url,
      language: repo.language || 'Other',
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      topics: repo.topics || [],
      score: calculateScore(repo)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

function formatTechStack(repo) {
  const techs = [repo.language, ...repo.topics.slice(0, 3)]
    .filter(Boolean)
    .filter(tech => tech.length < 15);

  return techs.join(' • ') || 'Various Technologies';
}

function generateFeaturedProjectsSection(topRepos) {
  let section = '## 🎯 Featured Projects\n\n';

  topRepos.forEach((repo) => {
    const techStack = formatTechStack(repo);
    const statsEmoji = repo.stars > 0 ? ` ⭐ ${repo.stars}` : '';

    section += `### 🔹 [${repo.name}](${repo.url})${statsEmoji}\n`;
    section += `**Tech:** ${techStack}\n`;
    section += `${repo.description}\n\n`;
  });

  section += '> 📌 Check out more projects pinned below!\n';

  return section;
}

function updateReadme(newSection) {
  const readme = fs.readFileSync(README_PATH, 'utf-8');

  const startMarker = '## 🎯 Featured Projects';
  const endMarker = '---';

  const startIndex = readme.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error('Featured Projects section not found in README.md');
  }

  const searchStart = startIndex + startMarker.length;
  const endIndex = readme.indexOf(endMarker, searchStart);
  if (endIndex === -1) {
    throw new Error('End marker not found after Featured Projects section');
  }

  const before = readme.substring(0, startIndex);
  const after = readme.substring(endIndex);

  const updatedReadme = before + newSection + '\n' + after;

  fs.writeFileSync(README_PATH, updatedReadme, 'utf-8');
  console.log('✅ README.md updated successfully!');
}

async function main() {
  try {
    console.log('🔍 Fetching repositories...');
    const repos = await fetchRepositories();
    console.log(`📦 Found ${repos.length} repositories`);

    console.log('🏆 Selecting top 5 projects...');
    const topRepos = getTopRepositories(repos, 5);

    console.log('\nTop 5 projects:');
    topRepos.forEach((repo, i) => {
      console.log(`${i + 1}. ${repo.name} (score: ${repo.score}, stars: ${repo.stars})`);
    });

    console.log('\n📝 Generating Featured Projects section...');
    const newSection = generateFeaturedProjectsSection(topRepos);

    console.log('💾 Updating README.md...');
    updateReadme(newSection);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
