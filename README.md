# Waggle

The hive communicates with a [waggle](https://en.wikipedia.org/wiki/Waggle_dance).



## Installation

First, install Go. The easiest way to do this on Ubuntu is through snap

```bash
sudo snap install go --classic
```

Download Waggle into your home directory with

```bash
cd && git clone git@github.com:CU-Robotics/waggle.git
```

or

```sh
cd && git clone https://github.com/CU-Robotics/waggle.git
```

Go into the Waggle directory

```bash
cd waggle
```

Build the Waggle binary

```bash
go build
```



## Usage

Run the run script

```bash
./tools/run.sh
```



## Updating

Pull the new code

```
git pull
```

Build the new waggle binary

```
go build
```



## Development

In addition to Go, you need to install node. This is easiest with nvm

```bash
cd && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Then install Node 20

```bash
nvm install 20
```

Set Node 20 as the default

```bash
nvm use 20
```

Install all node dependencies

```bash
cd ~/waggle/client && npm install
```

Now, whenever you make a change to Go code, run

```bash
go build
```

And whenever you make a change to the client code, run the following from **inside the `client/` directory**

```bash
npm run build
```
