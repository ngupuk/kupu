# Kupu

Kupu is an open source AI inpainter to remove object(s) from images while keeping the original image dimension intact.

<video src="kupu.mp4" controls> </video>

### Installation

This app is built using Ruby on Rails for the web app and Python for the image processing. Therefore, make sure that you have [Ruby](https://guides.rubyonrails.org/install_ruby_on_rails.html) and [Python >=3.12](https://www.python.org/downloads/) installed on your system.

Run the installation script to install required Ruby and Python packages on your terminal as follows:
```bash
./install.sh
```

If you have permission issues, run the following command :
```bash
chmod +x install.sh
```

### Usage

1. Open a terminal and run the following command to start the web app:
```bash
./start-web.sh
```

2. Open a new terminal and run the following command to start the server:
```bash
./start-server.sh
```

3. Open the web app in your browser at http://localhost:3000

### Acknowledgement

This repo uses a model downloaded from [IOpaint](https://github.com/Sanster/IOPaint/blob/main/iopaint/model/lama.py) which was originally developed by [LaMa](https://github.com/advimman/lama). Please visit the [LaMa](https://github.com/advimman/lama) repo if you want to know how to cite their work.
