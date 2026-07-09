const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// The script inserted '</div>\n      )}' at the end of newSettings which shouldn't be there.
// We can just find the end of the Danger Zone section and remove them.
const toReplace = `
          </section>
          )}

        </div>
      )}
      </div>
      )}

      {/* Spacing for bottom floating search bar so content doesn't get obscured */}`;

const replacement = `
          </section>
          )}

        </div>
      )}

      {/* Spacing for bottom floating search bar so content doesn't get obscured */}`;

if (content.includes(toReplace)) {
  fs.writeFileSync('src/App.tsx', content.replace(toReplace, replacement));
  console.log('Fixed');
} else {
  console.log('Could not find the block to replace');
}
