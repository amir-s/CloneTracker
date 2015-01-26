# Software Clone Tracking


### Steps
1. Install NodeJS and dependencies
2. Generate clones.
3. Extract bug IDs.
4. Extract bug informations.
5. Create the genealogy.
6. Combine the genealogy and bug informations.
7. Analysis.

### Walk Trough

Install NodeJS (http://nodejs.org). You can install the binary or compile it from the source.
Then `cd` to the project folder and run `npm install` to install the dependencies.

First, we need to generate all the clones in each commits. We'll use `Nicad` for generating finding clone pairs in a repository.
Assuming all the files are in `/path/to/folder` which we call it path. There should ba a folder named `output` in this folder and all the scripts should be in the path also.
There should be the git repository in the path which we want to extract the clone of.
Change the lines 24 to 26 in `generateClones.js` to match the values above.

Run `node generateClones.js` and it will fill up the output folder with clone informations. It will create another file named `commits` which contain all the informations of all the commits in the git repo.

Then we need the list of the bug ids for each commit in the repository. Edit the file `generateBugs.js` to change the path to git repo and also to change the regular expressions used to extract bug ID out of the commit message. By running `node generateBugs.js` the file `bugs.json` will be generated.

After that, we need all the information about each bug. We need to mine the bug repository to find out when the bug was reported and filed. Edit the file `generateBugInfo.js` to match the desired bug repository and mining technique then execute it `node generateBugInfo.js`. It will create `buginfo.json` file in the path.

We then should generate the genes from our clone informations. The file `generateGene.js` will do the job, it uses `git diff` along the clone information stored in `output/` for each commit to generate the result. Edit the file to change the path information and then run the script using node: `node generateGene.js result.json`. It will create `result.json` and store the results in it.

After that, it is needed to combine the bug information with the clone data. The script `combine.js` will use two file `buginfo.json` and `result.json` to generate `combined.json`. This file is ready to analyze.

The script `analyze.js` includes five functions for different analysis. By calling each function, the corresponding csv file will be printed.

----

### License
http://creativecommons.org/licenses/by-nc-sa/2.5/ca/legalcode.en

Amir Saboury

http://swat.polymtl.ca
