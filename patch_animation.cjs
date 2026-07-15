const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    boxShadow: isNew 
                      ? ['0px 0px 0px rgba(245,158,11,0)', '0px 0px 25px rgba(245,158,11,0.5)', '0px 0px 0px rgba(245,158,11,0)'] 
                      : 'none',
                  }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ 
                    duration: 0.3, 
                    type: "spring", 
                    bounce: 0.3,`;

const replace = `                  initial={{ opacity: 0, y: 40, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    boxShadow: isNew 
                      ? ['0px 0px 0px rgba(245,158,11,0)', '0px 0px 40px rgba(245,158,11,0.8)', '0px 0px 0px rgba(245,158,11,0)'] 
                      : 'none',
                  }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ 
                    duration: 0.5, 
                    type: "spring", 
                    bounce: 0.5,`;

code = code.replace(target, replace);
fs.writeFileSync('src/App.tsx', code);
