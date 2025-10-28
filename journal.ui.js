const term = require('terminal-kit').terminal;

var progressBar;

// --- Step 2: A helper function to color-code moods ---
function getMoodMarkup(mood) {
    switch (mood) {
        case 'Joyful': case 'Content': return `^+${mood}`; // Green
        case 'Anxious': case 'Upset': return `^-${mood}`; // Red
        default: return `^y${mood}`; // Yellow
    }
}

function initProgress() {
    progressBar = term.progressBar({
        width: 80,
        title: 'Fetching Journals:',
        eta: true,
        percent: true
    });
}
function progress(itemsProcessed, totalFiles) {
    progressBar.update(itemsProcessed / totalFiles);
}

// --- Step 3: Format the journal data into an array of strings for the menu ---
function tableMaker(journals) {
    const menuItems = journals.map(journal => {
        // We use padEnd to create nicely aligned columns within a single string
        const date = journal.date;
        const mood = journal.mood; // Markup counts as 2 chars
        const themes = journal.themes;
        return `${date} | ${mood} | ${themes}`;
    });

    term.bold.blue('--- Select a Journal Entry ---\n');
    term.dim('Use ↑ and ↓ to scroll, ENTER to select, CTRL+C to quit.\n\n');

    // --- Step 4: Create the interactive menu ---
    term.singleColumnMenu(menuItems, {
        // These options are passed to the menu
        style: term.inverse,
        selectedStyle: term.dim.blue.bgGreen,
        contentHasMarkup: true,
    }, (error, response) => {
        if (error) {
            term.red("\nAn error occurred.\n");
            process.exit(1);
        }

        // This callback function runs after the user presses ENTER
        term('\n');
        const selected = response.selectedIndex;
        journalDisplay(journals[selected]);

        // term.bold(`You selected journal #${response.selectedIndex + 1}: `);
        // term.green(`${response.selectedIndex.trim()}\n`);

        // Exit the process so the script doesn't hang
        process.exit(0);
    });


}

function journalDisplay(journal) {
    term.clear();
    term.bold.cyan(`Journal Entry for: ${journal.date}\n`);

    // Metadata: Show the mood and tags
    term.yellow(`Mood: `).green(journal.mood);
    term.yellow(`   Tags: `).magenta(`${journal.tags}\n`);

    // Separator: Add a visual line to separate header from body
    term.dim('─'.repeat(80) + '\n');

    // Body: Display the main journal entry text
    term(journal.entry);

    // Footer: Add a final separator
    term('\n' + '─'.repeat(80) + '\n');
}

module.exports = { tableMaker, initProgress, progress, journalDisplay };